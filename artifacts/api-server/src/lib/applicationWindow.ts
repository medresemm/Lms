export type ApplicationWindowStatus = "open" | "not_started" | "ended" | "unscheduled";

export type ApplicationWindow = {
  opensAt: string | null;
  closesAt: string | null;
  isOpen: boolean;
  nextOpenAt: string | null;
  status: ApplicationWindowStatus;
};

export function getApplicationWindowStatus(
  opensAt: string | null,
  closesAt: string | null,
  now = Date.now(),
): ApplicationWindow {
  if (!opensAt || !closesAt) {
    return { opensAt, closesAt, isOpen: true, nextOpenAt: null, status: "unscheduled" };
  }

  const opens = Date.parse(opensAt);
  const closes = Date.parse(closesAt);
  if (!Number.isFinite(opens) || !Number.isFinite(closes) || closes <= opens) {
    return { opensAt, closesAt, isOpen: false, nextOpenAt: null, status: "ended" };
  }
  if (now < opens) {
    return { opensAt, closesAt, isOpen: false, nextOpenAt: opensAt, status: "not_started" };
  }
  if (now >= closes) {
    return { opensAt, closesAt, isOpen: false, nextOpenAt: null, status: "ended" };
  }
  return { opensAt, closesAt, isOpen: true, nextOpenAt: null, status: "open" };
}