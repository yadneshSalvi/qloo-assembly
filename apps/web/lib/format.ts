export function eventDate(date: string, short = false) {
  const parsed = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime())) return "Date to choose";
  return new Intl.DateTimeFormat(
    "en-GB",
    short
      ? { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }
      : {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        },
  ).format(parsed);
}
