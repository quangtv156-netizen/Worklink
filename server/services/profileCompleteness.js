export const PHONE_REGEX = /^(0|\+84)\d{9}$/;

export function normalizePhone(value) {
  return String(value ?? "").replace(/[\s.\-()]/g, "");
}

export function validateDateOfBirth(value) {
  const str = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str))
    return "Ngày sinh không hợp lệ (định dạng YYYY-MM-DD)";
  const dob = new Date(`${str}T00:00:00Z`);
  if (Number.isNaN(dob.getTime()) || dob.toISOString().slice(0, 10) !== str) {
    return "Ngày sinh không hợp lệ";
  }
  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < dob.getUTCMonth() ||
    (now.getUTCMonth() === dob.getUTCMonth() &&
      now.getUTCDate() < dob.getUTCDate());
  if (beforeBirthday) age -= 1;
  if (age < 15) return "Bạn cần từ 15 tuổi trở lên để sử dụng WorkLink";
  if (age > 100) return "Ngày sinh không hợp lệ";
  return null;
}

export function validatePhone(value) {
  return PHONE_REGEX.test(normalizePhone(value))
    ? null
    : "Số điện thoại không hợp lệ (ví dụ: 0912345678)";
}

export function isProfileComplete(row) {
  if (!row) return false;
  if (row.role !== "job_seeker") return true;
  const filled = (v) => typeof v === "string" && v.trim().length > 0;
  return (
    filled(row.name) &&
    validatePhone(row.phone) === null &&
    validateDateOfBirth(row.date_of_birth) === null &&
    filled(row.city) &&
    filled(row.district) &&
    filled(row.full_address) &&
    row.full_address.trim().length >= 5
  );
}

export const PROFILE_COMPLETENESS_COLUMNS =
  "role, name, phone, date_of_birth, district, city, full_address";
