import React, { useState } from "react";
import { UserCheck, LogOut, Loader2 } from "lucide-react";
import { useAuth } from "../context/AppContext";
import { apiUpdateProfile } from "../services/api";

const PHONE_REGEX = /^(0|\+84)\d{9}$/;

function validate(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = "Vui lòng nhập họ và tên";

  const phone = form.phone.replace(/[\s.\-()]/g, "");
  if (!PHONE_REGEX.test(phone))
    errors.phone = "Số điện thoại không hợp lệ (ví dụ: 0912345678)";

  if (!form.dateOfBirth) {
    errors.dateOfBirth = "Vui lòng chọn ngày sinh";
  } else {
    const dob = new Date(`${form.dateOfBirth}T00:00:00`);
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const beforeBirthday =
      now.getMonth() < dob.getMonth() ||
      (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate());
    if (beforeBirthday) age -= 1;
    if (Number.isNaN(age) || age < 15 || age > 100) {
      errors.dateOfBirth =
        "Bạn cần từ 15 tuổi trở lên và ngày sinh phải hợp lệ";
    }
  }

  if (!form.city.trim()) errors.city = "Vui lòng nhập tỉnh/thành phố";
  if (!form.district.trim()) errors.district = "Vui lòng nhập quận/huyện";
  if (form.fullAddress.trim().length < 5)
    errors.fullAddress =
      "Vui lòng nhập địa chỉ chi tiết (số nhà, đường, phường/xã)";
  return errors;
}

const inputClass =
  "w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border text-sm text-white focus:outline-none focus:border-indigo-500";

export default function ProfileSetupModal() {
  const { currentUser, setCurrentUser, setUserProfile, logout, showToast } =
    useAuth();

  const [form, setForm] = useState({
    name: currentUser?.name || "",
    phone: currentUser?.phone || "",
    dateOfBirth: currentUser?.dateOfBirth || "",
    city: currentUser?.city || "Hà Nội",
    district: currentUser?.district || "",
    fullAddress: currentUser?.fullAddress || "",
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState("");

  const setField = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError("");
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      const res = await apiUpdateProfile({
        name: form.name.trim(),
        phone: form.phone.replace(/[\s.\-()]/g, ""),
        date_of_birth: form.dateOfBirth,
        city: form.city.trim(),
        district: form.district.trim(),
        full_address: form.fullAddress.trim(),
      });

      const saved = res?.user || {};
      if (!saved.profileComplete) {
        setServerError(
          "Máy chủ chưa xác nhận hồ sơ đầy đủ, vui lòng kiểm tra lại các trường.",
        );
        return;
      }

      const merged = { ...currentUser, ...saved };
      setCurrentUser(merged);
      try {
        localStorage.setItem("worklink_user", JSON.stringify(merged));
      } catch {}
      setUserProfile((prev) => ({
        ...(prev || {}),
        name: saved.name,
        phone: saved.phone,
        district: saved.district,
        city: saved.city,
      }));
      showToast("Đã lưu thông tin cá nhân. Chào mừng bạn đến với WorkLink!");
    } catch (err) {
      setServerError(
        err?.message || "Không lưu được thông tin, vui lòng thử lại.",
      );
    } finally {
      setSaving(false);
    }
  };

  const field = (label, key, props = {}) => (
    <div>
      <label className="text-xs font-semibold text-slate-300 block mb-1">
        {label} *
      </label>
      <input
        value={form[key]}
        onChange={setField(key)}
        className={`${inputClass} ${errors[key] ? "border-rose-500" : "border-slate-800"}`}
        {...props}
      />
      {errors[key] && (
        <p className="text-[11px] text-rose-400 mt-1">{errors[key]}</p>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950 overflow-y-auto">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden my-auto">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800 bg-slate-950/70">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-white">
              Hoàn tất thông tin cá nhân
            </h2>
            <p className="text-xs text-slate-400">
              Bạn cần khai báo thông tin cơ bản trước khi sử dụng WorkLink.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4" noValidate>
          {field("Họ và tên", "name", {
            type: "text",
            autoComplete: "name",
            placeholder: "Nguyễn Văn A",
          })}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {field("Số điện thoại", "phone", {
              type: "tel",
              autoComplete: "tel",
              placeholder: "0912345678",
              inputMode: "tel",
            })}
            {field("Ngày sinh", "dateOfBirth", {
              type: "date",
              max: new Date().toISOString().slice(0, 10),
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {field("Tỉnh / Thành phố", "city", {
              type: "text",
              placeholder: "Hà Nội",
            })}
            {field("Quận / Huyện", "district", {
              type: "text",
              placeholder: "Cầu Giấy",
            })}
          </div>

          {field("Địa chỉ chi tiết", "fullAddress", {
            type: "text",
            autoComplete: "street-address",
            placeholder: "Số nhà, đường, phường/xã",
          })}

          <p className="text-[11px] text-slate-500 leading-relaxed">
            Thông tin được dùng để nhà tuyển dụng liên hệ và gợi ý việc làm gần
            bạn. Bạn có thể chỉnh sửa lại trong trang hồ sơ bất cứ lúc nào.
          </p>

          {serverError && (
            <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">
              {serverError}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-60 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <UserCheck className="w-4 h-4" />
            )}
            Lưu và tiếp tục
          </button>

          <button
            type="button"
            onClick={logout}
            className="w-full py-2 text-xs text-slate-400 hover:text-white flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" /> Đăng xuất
          </button>
        </form>
      </div>
    </div>
  );
}
