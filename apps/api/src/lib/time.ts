const durationRegexp = /^(\d+)([smhd])$/;

export function parseDurationToMs(value: string): number {
  const match = durationRegexp.exec(value.trim());
  if (!match) {
    throw new Error(`Некорректный формат длительности: ${value}`);
  }

  const amount = Number(match[1]);
  const unit = match[2];

  switch (unit) {
    case "s":
      return amount * 1000;
    case "m":
      return amount * 60 * 1000;
    case "h":
      return amount * 60 * 60 * 1000;
    case "d":
      return amount * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Неподдерживаемая единица длительности: ${unit}`);
  }
}
