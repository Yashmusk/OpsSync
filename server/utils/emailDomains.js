// Free / public email providers. These can never be used as a company's
// sign-up domain, otherwise anyone with e.g. a Gmail account could join.
const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.in", "yahoo.co.in", "ymail.com",
  "rocketmail.com", "outlook.com", "outlook.in", "hotmail.com", "hotmail.co.in", "live.com",
  "live.in", "msn.com", "icloud.com", "me.com", "mac.com", "aol.com", "protonmail.com",
  "proton.me", "pm.me", "zoho.com", "zohomail.in", "zohomail.com", "rediffmail.com",
  "rediff.com", "gmx.com", "gmx.net", "mail.com", "yandex.com", "yandex.ru", "tutanota.com",
  "tuta.io", "fastmail.com", "hey.com", "inbox.com", "qq.com", "163.com",
]);

const DOMAIN_RE = /^(?=.{3,100}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;

const getEmailDomain = (email) => {
  const at = String(email || "").lastIndexOf("@");
  return at === -1 ? "" : String(email).slice(at + 1).trim().toLowerCase();
};

const isPublicDomain = (domain) => PUBLIC_EMAIL_DOMAINS.has(String(domain || "").toLowerCase());

const normalizeDomain = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");

const isValidDomain = (domain) => DOMAIN_RE.test(domain);

// Does this email's domain match one of the company's domains?
// Exact match only: "nutrabay.com" does not allow "evil-nutrabay.com" or "x.nutrabay.com".
const emailMatchesDomains = (email, domains = []) => {
  const domain = getEmailDomain(email);
  return Boolean(domain) && domains.includes(domain);
};

module.exports = {
  PUBLIC_EMAIL_DOMAINS,
  getEmailDomain,
  isPublicDomain,
  normalizeDomain,
  isValidDomain,
  emailMatchesDomains,
};
