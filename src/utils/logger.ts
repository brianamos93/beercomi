import winston from "winston";

const { combine, timestamp, colorize, printf } = winston.format;

const devFormat = printf((info) => {
  const { level, message, timestamp, ...meta } = info;

  const msg =
    typeof message === "object"
      ? JSON.stringify(message, null, 2)
      : message;

  const metaString =
    Object.keys(meta).length > 0
      ? JSON.stringify(meta, null, 2)
      : "";

  return `${timestamp} [${level}] : ${msg} ${metaString}`;
});

export const logger = winston.createLogger({
  level: "info",
  format: combine(timestamp()),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), timestamp(), winston.format.prettyPrint()),
    }),
  ],
});