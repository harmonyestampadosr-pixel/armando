import { AlertTriangle, Loader2, Wifi, WifiOff } from 'lucide-react';
import type { SocketConnectionStatus } from '../hooks/useGameSocket';

interface ConnectionStatusBadgeProps {
  status: SocketConnectionStatus;
  compact?: boolean;
}

const STATUS_META: Record<
  SocketConnectionStatus,
  { label: string; textClass: string; dotClass: string }
> = {
  connecting: {
    label: 'Conectando',
    textClass: 'text-sky-300',
    dotClass: 'bg-sky-400',
  },
  connected: {
    label: 'Conectado',
    textClass: 'text-emerald-400',
    dotClass: 'bg-emerald-400',
  },
  reconnecting: {
    label: 'Reconectando',
    textClass: 'text-amber-300',
    dotClass: 'bg-amber-400',
  },
  offline: {
    label: 'Sin conexión',
    textClass: 'text-rose-400',
    dotClass: 'bg-rose-400',
  },
  unavailable: {
    label: 'Partida no disponible',
    textClass: 'text-rose-400',
    dotClass: 'bg-rose-400',
  },
};

export function ConnectionStatusBadge({
  status,
  compact = false,
}: ConnectionStatusBadgeProps) {
  const meta = STATUS_META[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold ${
        compact ? 'text-[11px]' : 'text-xs'
      } ${meta.textClass}`}
      data-connection-status={status}
    >
      {status === 'connected' ? (
        <Wifi className="w-3.5 h-3.5 shrink-0" />
      ) : status === 'offline' ? (
        <WifiOff className="w-3.5 h-3.5 shrink-0" />
      ) : status === 'unavailable' ? (
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
      ) : (
        <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
      )}
      <span>{meta.label}</span>
    </span>
  );
}
