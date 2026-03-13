const SENSITIVE_FIELDS = [
  "password",
  "confirmpassword",
  "token",
  "accesstoken",
  "refreshtoken",
  "authorization",
  "cookie",
];

export const sanitizeLog = (data: any): any => {
  if (!data) return data;

  let parsed = data;

  // If body is a JSON string, parse it
  if (typeof data === "string") {
    try {
      parsed = JSON.parse(data);
    } catch {
      return data;
    }
  }

  if (typeof parsed !== "object") return parsed;

  const clone = JSON.parse(JSON.stringify(parsed));

  const removeSensitive = (obj: any) => {
    for (const key of Object.keys(obj)) {
      if (SENSITIVE_FIELDS.includes(key.toLowerCase())) {
        obj[key] = "[REDACTED]";
      } else if (typeof obj[key] === "object" && obj[key] !== null) {
        removeSensitive(obj[key]);
      }
    }
  };

  removeSensitive(clone);

  return clone;
};