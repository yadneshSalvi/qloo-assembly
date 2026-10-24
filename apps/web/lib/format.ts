export function eventDate(date: string, short = false) {
  return new Intl.DateTimeFormat(
    "en-GB",
    short
      ? { day: "numeric", month: "short", year: "numeric" }
      : { weekday: "long", day: "numeric", month: "long", year: "numeric" },
  ).format(new Date(`${date}T12:00:00Z`));
}
