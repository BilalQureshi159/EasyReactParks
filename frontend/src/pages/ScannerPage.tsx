import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  QrCode, CheckCircle2, XCircle, Keyboard, Users, Ticket,
  ScanLine, RefreshCw, Clock,
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { api } from '@/lib/api';
import { cn, formatDateTime } from '@/lib/utils';
import { Button, Input, Badge } from '@/components/ui';
import type { OrderDetail } from '@/types/orders';
import { useTenantId, tenantQueryKey } from '@/hooks/useTenantScope';

type ScannerMode = 'ticket' | 'order';

interface ScanResult {
  valid: boolean;
  type: string;
  message: string;
  ticket?: { ticketId: string; ticketTypeName: string; status: string };
  membership?: { memberName: string; planName: string };
}

interface ScanHistoryEntry {
  id: string;
  result: string;
  message: string;
  scannedAt: string;
  guestLabel: string;
  ticketId: string | null;
  scannedByName: string;
}

interface OrderLookupResult extends OrderDetail {
  summary: { validCount: number; usedCount: number; totalTickets: number };
}

interface BulkCheckInResult {
  order: {
    id: string;
    orderNumber: string;
    customerName?: string;
    customerPhone?: string;
    ticketCount: number;
  };
  grantedCount: number;
  deniedCount: number;
  results: {
    ticketId: string;
    ticketTypeName: string;
    granted: boolean;
    message: string;
    status: string;
  }[];
}

const SCAN_COOLDOWN_MS = 2500;
const RESULT_DISPLAY_MS = 3500;

function ticketStatusVariant(status: string) {
  if (status === 'valid') return 'success' as const;
  if (status === 'used') return 'primary' as const;
  return 'default' as const;
}

function parseScannedCode(code: string): string {
  try {
    const parsed = JSON.parse(code);
    if (parsed.code) return String(parsed.code).trim();
  } catch {
    // not JSON
  }
  return code.trim();
}

function isToday(d: string | Date) {
  const date = new Date(d);
  const now = new Date();
  return date.toDateString() === now.toDateString();
}

export function ScannerPage() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  const [mode, setMode] = useState<ScannerMode>('ticket');
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [orderQuery, setOrderQuery] = useState('');
  const [orderPreview, setOrderPreview] = useState<OrderLookupResult | null>(null);
  const [bulkResult, setBulkResult] = useState<BulkCheckInResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const resultTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastScanRef = useRef<{ code: string; at: number } | null>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);

  const refreshHistory = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: tenantQueryKey(tenantId, 'scanner-history') });
  }, [queryClient, tenantId]);

  const showResult = useCallback((data: ScanResult) => {
    setLastResult(data);
    if (resultTimeoutRef.current) clearTimeout(resultTimeoutRef.current);
    resultTimeoutRef.current = setTimeout(() => setLastResult(null), RESULT_DISPLAY_MS);
    refreshHistory();
  }, [refreshHistory]);

  const { data: history = [], isFetching: historyFetching } = useQuery({
    queryKey: tenantQueryKey(tenantId, 'scanner-history'),
    queryFn: () => api.get<ScanHistoryEntry[]>('/scanner/history'),
    enabled: Boolean(tenantId),
    refetchInterval: 15000,
  });

  const todayStats = useMemo(() => {
    const today = history.filter((h) => isToday(h.scannedAt));
    return {
      granted: today.filter((h) => h.result === 'granted').length,
      denied: today.filter((h) => h.result === 'denied').length,
    };
  }, [history]);

  const validateMutation = useMutation({
    mutationFn: (code: string) => api.post<ScanResult>('/scanner/validate', { code }),
    onSuccess: (data) => showResult(data),
  });

  const orderLookupMutation = useMutation({
    mutationFn: (query: string) => api.post<OrderLookupResult>('/scanner/order-lookup', { query }),
    onSuccess: (data) => {
      setOrderPreview(data);
      setBulkResult(null);
    },
    onError: () => setOrderPreview(null),
  });

  const bulkCheckInMutation = useMutation({
    mutationFn: (orderId: string) => api.post<BulkCheckInResult>('/scanner/checkin-order', { orderId }),
    onSuccess: (data) => {
      setBulkResult(data);
      showResult({
        valid: data.grantedCount > 0,
        type: 'order',
        message: `${data.grantedCount} checked in · ${data.deniedCount} skipped`,
      });
      if (orderPreview) {
        setOrderPreview({
          ...orderPreview,
          tickets: orderPreview.tickets.map((t) => {
            const match = data.results.find((r) => r.ticketId === t.ticketCode);
            return match ? { ...t, status: match.status } : t;
          }),
          summary: {
            validCount: orderPreview.tickets.filter((t) => {
              const match = data.results.find((r) => r.ticketId === t.ticketCode);
              return (match?.status ?? t.status) === 'valid';
            }).length,
            usedCount: orderPreview.tickets.filter((t) => {
              const match = data.results.find((r) => r.ticketId === t.ticketCode);
              return (match?.status ?? t.status) === 'used';
            }).length,
            totalTickets: orderPreview.tickets.length,
          },
        });
      }
      refreshHistory();
    },
  });

  const tryScan = useCallback((rawCode: string, handler: (code: string) => void) => {
    const code = parseScannedCode(rawCode);
    if (!code) return;

    const now = Date.now();
    if (
      lastScanRef.current &&
      lastScanRef.current.code === code &&
      now - lastScanRef.current.at < SCAN_COOLDOWN_MS
    ) {
      return;
    }
    lastScanRef.current = { code, at: now };
    handler(code);
  }, []);

  const handleTicketScan = useCallback((code: string) => {
    if (validateMutation.isPending) return;
    tryScan(code, (c) => validateMutation.mutate(c));
  }, [validateMutation, tryScan]);

  const handleOrderScan = useCallback((code: string) => {
    if (orderLookupMutation.isPending) return;
    tryScan(code, (c) => {
      setOrderQuery(c);
      orderLookupMutation.mutate(c);
    });
  }, [orderLookupMutation, tryScan]);

  const handleScan = useCallback((code: string) => {
    if (mode === 'order') handleOrderScan(code);
    else handleTicketScan(code);
  }, [mode, handleOrderScan, handleTicketScan]);

  useEffect(() => {
    let mounted = true;

    const startScanner = async () => {
      try {
        if (scannerRef.current?.isScanning) {
          await scannerRef.current.stop();
        }

        const scanner = new Html5Qrcode('qr-reader');
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 260, height: 260 } },
          (decodedText) => {
            if (mounted) handleScan(decodedText);
          },
          () => {},
        );

        if (mounted) {
          setScanning(true);
          setCameraError(null);
        }
      } catch {
        if (mounted) {
          setCameraError('Camera unavailable — use manual entry below.');
          setScanning(false);
        }
      }
    };

    startScanner();

    return () => {
      mounted = false;
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
      if (resultTimeoutRef.current) clearTimeout(resultTimeoutRef.current);
    };
  }, [handleScan]);

  const submitManualTicket = () => {
    if (!manualCode.trim()) return;
    handleTicketScan(manualCode);
    setManualCode('');
    manualInputRef.current?.focus();
  };

  return (
    <div className="animate-fade-in -m-8 min-h-[calc(100vh-4rem)] bg-slate-100">
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <ScanLine className="h-5 w-5 text-brand-600" />
              Gate scanner
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Scan tickets or check in whole orders — activity updates live
            </p>
          </div>

          <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1 shrink-0">
            <button
              type="button"
              onClick={() => { setMode('ticket'); setOrderPreview(null); setBulkResult(null); }}
              className={cn(
                'flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                mode === 'ticket' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900',
              )}
            >
              <Ticket className="h-4 w-4" />
              Single ticket
            </button>
            <button
              type="button"
              onClick={() => { setMode('order'); setOrderPreview(null); setBulkResult(null); }}
              className={cn(
                'flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                mode === 'order' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900',
              )}
            >
              <Users className="h-4 w-4" />
              Order check-in
            </button>
          </div>
        </div>
      </div>

      {/* Result banner */}
      {lastResult && (
        <div
          className={cn(
            'px-6 py-4 border-b animate-fade-in',
            lastResult.valid
              ? 'bg-emerald-600 border-emerald-700 text-white'
              : 'bg-red-600 border-red-700 text-white',
          )}
        >
          <div className="max-w-6xl mx-auto flex items-center gap-4">
            {lastResult.valid ? (
              <CheckCircle2 className="h-10 w-10 shrink-0" />
            ) : (
              <XCircle className="h-10 w-10 shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-lg font-bold">
                {lastResult.valid ? 'Entry granted' : 'Entry denied'}
              </p>
              <p className="text-sm opacity-90">{lastResult.message}</p>
              {lastResult.ticket && (
                <p className="text-sm opacity-80 mt-0.5">
                  {lastResult.ticket.ticketTypeName} · {lastResult.ticket.ticketId}
                </p>
              )}
              {lastResult.membership && (
                <p className="text-sm opacity-80 mt-0.5">
                  {lastResult.membership.memberName} · {lastResult.membership.planName}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Scanner column */}
        <div className="lg:col-span-3 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 text-sm text-slate-600">
              <QrCode className="h-4 w-4 text-brand-600" />
              {mode === 'ticket' ? 'Point camera at ticket QR or enter Ticket ID' : 'Scan ticket QR to find order, or search manually'}
            </div>

            <div className="relative bg-slate-900">
              <div
                id="qr-reader"
                className="w-full min-h-[280px] [&>video]:w-full [&>video]:max-h-[360px] [&>video]:object-cover"
              />
              {!scanning && !cameraError && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-800/90">
                  <p className="text-white/70 text-sm">Starting camera…</p>
                </div>
              )}
              {scanning && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-56 h-56 border-2 border-white/40 rounded-2xl" />
                </div>
              )}
            </div>

            {cameraError && (
              <p className="px-4 py-2 text-sm text-amber-700 bg-amber-50 border-t border-amber-100">
                {cameraError}
              </p>
            )}

            {mode === 'ticket' ? (
              <div className="p-4 flex gap-2 border-t border-slate-100">
                <Input
                  ref={manualInputRef}
                  placeholder="Ticket ID (e.g. adult-day-pass-0001)"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitManualTicket()}
                  className="font-mono"
                  autoFocus
                />
                <Button
                  size="lg"
                  onClick={submitManualTicket}
                  loading={validateMutation.isPending}
                  disabled={!manualCode.trim()}
                >
                  <Keyboard className="h-4 w-4" />
                  Check in
                </Button>
              </div>
            ) : (
              <div className="p-4 space-y-4 border-t border-slate-100">
                <div className="flex gap-2">
                  <Input
                    placeholder="Order ID, Ticket ID, phone, name, or email"
                    value={orderQuery}
                    onChange={(e) => setOrderQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && orderQuery.trim()) {
                        orderLookupMutation.mutate(orderQuery.trim());
                      }
                    }}
                  />
                  <Button
                    size="lg"
                    onClick={() => orderQuery.trim() && orderLookupMutation.mutate(orderQuery.trim())}
                    loading={orderLookupMutation.isPending}
                  >
                    Find order
                  </Button>
                </div>

                {orderLookupMutation.isError && (
                  <p className="text-sm text-red-600">No order found for that search.</p>
                )}

                {orderPreview && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div>
                        <p className="font-mono font-bold text-lg text-brand-700">
                          {orderPreview.order.orderNumber}
                        </p>
                        <p className="text-sm text-slate-600 mt-1">
                          {orderPreview.order.customerName || 'Guest'}
                          {orderPreview.order.customerPhone && ` · ${orderPreview.order.customerPhone}`}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {orderPreview.summary.validCount} ready · {orderPreview.summary.usedCount} already used
                        </p>
                      </div>
                      <Button
                        size="lg"
                        disabled={orderPreview.summary.validCount === 0 || bulkCheckInMutation.isPending}
                        onClick={() => bulkCheckInMutation.mutate(orderPreview.order.id)}
                        loading={bulkCheckInMutation.isPending}
                      >
                        Check in all ({orderPreview.summary.validCount})
                      </Button>
                    </div>

                    <div className="rounded-lg border border-slate-200 overflow-hidden max-h-48 overflow-y-auto bg-white">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Ticket ID</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Type</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {orderPreview.tickets.map((t) => (
                            <tr key={t.id}>
                              <td className="px-3 py-2 font-mono text-xs font-semibold text-brand-700">
                                {t.ticketCode}
                              </td>
                              <td className="px-3 py-2 text-slate-700">{t.ticketTypeName}</td>
                              <td className="px-3 py-2">
                                <Badge variant={ticketStatusVariant(t.status)}>{t.status}</Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {bulkResult && (
                      <p className="text-sm text-emerald-700 font-medium">
                        Checked in {bulkResult.grantedCount} ticket{bulkResult.grantedCount !== 1 ? 's' : ''}
                        {bulkResult.deniedCount > 0 && ` · ${bulkResult.deniedCount} skipped`}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Live activity column */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Today&apos;s activity</h2>
              <button
                type="button"
                onClick={refreshHistory}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                title="Refresh"
              >
                <RefreshCw className={cn('h-4 w-4', historyFetching && 'animate-spin')} />
              </button>
            </div>

            <div className="grid grid-cols-2 divide-x divide-slate-100 border-b border-slate-100">
              <div className="px-4 py-3 text-center">
                <p className="text-2xl font-bold text-emerald-600">{todayStats.granted}</p>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Granted</p>
              </div>
              <div className="px-4 py-3 text-center">
                <p className="text-2xl font-bold text-red-600">{todayStats.denied}</p>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Denied</p>
              </div>
            </div>

            <div className="px-4 py-2 border-b border-slate-100 bg-slate-50">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Recent scans
              </p>
            </div>

            <div className="max-h-[min(520px,calc(100vh-280px))] overflow-y-auto divide-y divide-slate-100">
              {history.length === 0 ? (
                <p className="p-6 text-center text-sm text-slate-400">No scans yet — check in a guest to start</p>
              ) : (
                history.map((entry) => (
                  <div
                    key={entry.id}
                    className={cn(
                      'px-4 py-3 flex gap-3 items-start transition-colors',
                      entry.result === 'granted' ? 'bg-emerald-50/50' : 'bg-red-50/40',
                      lastResult && entry.id === history[0]?.id && 'ring-2 ring-inset ring-brand-200',
                    )}
                  >
                    <div className="shrink-0 mt-0.5">
                      {entry.result === 'granted' ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-slate-900 text-sm truncate">
                          {entry.guestLabel}
                        </span>
                        <Badge variant={entry.result === 'granted' ? 'success' : 'danger'} className="text-[10px]">
                          {entry.result}
                        </Badge>
                      </div>
                      {entry.ticketId && (
                        <p className="font-mono text-xs text-brand-700 mt-0.5">{entry.ticketId}</p>
                      )}
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{entry.message}</p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {formatDateTime(entry.scannedAt)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
