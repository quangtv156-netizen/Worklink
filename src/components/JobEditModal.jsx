import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  X, 
  Save, 
  MapPin, 
  DollarSign, 
  FileText, 
  Sparkles
} from 'lucide-react';
import { soundFx } from '../services/soundEffects';

export default function JobEditModal() {
  const { editingJob, setEditingJob, updateJob, showToast } = useApp();

  const [form, setForm] = useState({
    title: '',
    category: 'F&B',
    jobType: 'PART_TIME',
    salaryDisplay: '',
    salaryType: 'hourly',
    salaryMin: 30000,
    salaryMax: 40000,
    district: 'Cầu Giấy',
    address: '',
    timeShift: 'Tối',
    timeHours: '18:00 - 23:00',
    slots: 2,
    deadline: '',
    experience: 'NO_EXPERIENCE',
    description: '',
    requirements: '',
    benefits: '',
    hashtags: ''
  });

  useEffect(() => {
    if (editingJob) {
      setForm({
        title: editingJob.title || '',
        category: editingJob.category || 'F&B',
        jobType: editingJob.jobType || 'PART_TIME',
        salaryDisplay: editingJob.salaryDisplay || '',
        salaryType: editingJob.salaryType || 'hourly',
        salaryMin: editingJob.salaryMin || 30000,
        salaryMax: editingJob.salaryMax || 40000,
        district: editingJob.district || 'Cầu Giấy',
        address: editingJob.address || '',
        timeShift: editingJob.timeShift || 'Tối',
        timeHours: editingJob.timeHours || '18:00 - 23:00',
        slots: editingJob.slots || 1,
        deadline: editingJob.deadline || '',
        experience: editingJob.experience || 'NO_EXPERIENCE',
        description: editingJob.description || '',
        requirements: Array.isArray(editingJob.requirements) 
          ? editingJob.requirements.join(', ') 
          : (editingJob.requirements || ''),
        benefits: Array.isArray(editingJob.benefits) 
          ? editingJob.benefits.join(', ') 
          : (editingJob.benefits || ''),
        hashtags: Array.isArray(editingJob.hashtags) 
          ? editingJob.hashtags.join(' ') 
          : (editingJob.hashtags || '')
      });
    }
  }, [editingJob]);

  if (!editingJob) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      showToast('Vui lòng nhập tiêu đề công việc!', 'error');
      return;
    }

    soundFx.playPop();

    const reqArray = form.requirements
      .split(',')
      .map(r => r.trim())
      .filter(Boolean);

    const benArray = form.benefits
      .split(',')
      .map(b => b.trim())
      .filter(Boolean);

    const hashArray = form.hashtags
      .split(' ')
      .map(t => t.trim())
      .filter(Boolean)
      .map(t => t.startsWith('#') ? t : `#${t}`);

    const success = await updateJob(editingJob.id, {
      ...form,
      requirements: reqArray,
      benefits: benArray,
      hashtags: hashArray,
      slots: Number(form.slots) || 1,
      salaryMin: Number(form.salaryMin) || 0,
      salaryMax: Number(form.salaryMax) || 0
    });

    if (success) {
      setEditingJob(null);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={() => setEditingJob(null)}
    >
      <div 
        className="relative w-full max-w-3xl max-h-[92vh] bg-slate-900 border border-purple-500/30 rounded-3xl shadow-2xl shadow-purple-950/40 overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-400 flex items-center justify-center text-xl">
              {editingJob.companyLogo || '✏️'}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Chỉnh sửa tin tuyển dụng
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 font-normal">
                  ID: {editingJob.id}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Đơn vị: <strong className="text-purple-300">{editingJob.company}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={() => setEditingJob(null)}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 text-left">
          
          {/* Section 1: Thông tin cơ bản */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Thông tin cốt lõi</span>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                Tiêu đề công việc <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ví dụ: Nhân viên Barista ca tối, Phục vụ quán cafe..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-purple-500 text-white text-sm focus:outline-none transition-colors"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Danh mục ngành nghề</label>
                <select
                  value={form.category}
                  onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-purple-500 text-white text-sm focus:outline-none"
                >
                  <option value="F&B">F&B (Nhà hàng / Cafe / Quán ăn)</option>
                  <option value="Bán hàng">Bán hàng / Thu ngân / Shop</option>
                  <option value="IT">Công nghệ / Lập trình / IT</option>
                  <option value="Marketing">Marketing / Truyền thông / Content</option>
                  <option value="Gia sư">Gia sư / Giáo dục / Trợ giảng</option>
                  <option value="Kho vận">Kho vận / Giao hàng / Đóng gói</option>
                  <option value="Thiết kế">Thiết kế / Media / Quay dựng</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Hình thức làm việc</label>
                <select
                  value={form.jobType}
                  onChange={e => setForm(prev => ({ ...prev, jobType: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-purple-500 text-white text-sm focus:outline-none"
                >
                  <option value="PART_TIME">Bán thời gian (Part-time)</option>
                  <option value="FULL_TIME">Toàn thời gian (Full-time)</option>
                  <option value="INTERN">Thực tập sinh (Intern)</option>
                  <option value="FREELANCE">Làm từ xa / Freelance</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Mức lương & Thời gian làm việc */}
          <div className="pt-3 border-t border-slate-800/80 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
              <DollarSign className="w-3.5 h-3.5" />
              <span>Mức lương & Ca làm việc</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Mức lương hiển thị</label>
                <input
                  type="text"
                  value={form.salaryDisplay}
                  onChange={e => setForm(prev => ({ ...prev, salaryDisplay: e.target.value }))}
                  placeholder="Ví dụ: 35.000đ - 40.000đ/giờ"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-purple-500 text-white text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Loại lương</label>
                <select
                  value={form.salaryType}
                  onChange={e => setForm(prev => ({ ...prev, salaryType: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-purple-500 text-white text-sm focus:outline-none"
                >
                  <option value="hourly">Theo giờ (đ/giờ)</option>
                  <option value="monthly">Theo tháng (đ/tháng)</option>
                  <option value="shift">Theo ca làm (đ/ca)</option>
                  <option value="deal">Thỏa thuận</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Ca làm việc</label>
                <input
                  type="text"
                  value={form.timeShift}
                  onChange={e => setForm(prev => ({ ...prev, timeShift: e.target.value }))}
                  placeholder="Ví dụ: Tối, Sáng, Chiều, Linh hoạt..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-purple-500 text-white text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Khung giờ chi tiết</label>
                <input
                  type="text"
                  value={form.timeHours}
                  onChange={e => setForm(prev => ({ ...prev, timeHours: e.target.value }))}
                  placeholder="Ví dụ: 18:00 - 23:00 hoặc 4 tiếng/ngày"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-purple-500 text-white text-sm focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Địa điểm & Số lượng */}
          <div className="pt-3 border-t border-slate-800/80 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-400">
              <MapPin className="w-3.5 h-3.5" />
              <span>Địa điểm & Kế hoạch tuyển</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Quận / Huyện</label>
                <input
                  type="text"
                  value={form.district}
                  onChange={e => setForm(prev => ({ ...prev, district: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-purple-500 text-white text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Số lượng tuyển (người)</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={form.slots}
                  onChange={e => setForm(prev => ({ ...prev, slots: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-purple-500 text-white text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Hạn nộp hồ sơ</label>
                <input
                  type="date"
                  value={form.deadline}
                  onChange={e => setForm(prev => ({ ...prev, deadline: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-purple-500 text-white text-sm focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Địa chỉ làm việc cụ thể</label>
              <input
                type="text"
                value={form.address}
                onChange={e => setForm(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Ví dụ: 124 Xuân Thủy, Dịch Vọng Hậu, Cầu Giấy, Hà Nội"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-purple-500 text-white text-sm focus:outline-none"
              />
            </div>
          </div>

          {/* Section 4: Yêu cầu, Quyền lợi & Mô tả */}
          <div className="pt-3 border-t border-slate-800/80 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-400">
              <FileText className="w-3.5 h-3.5" />
              <span>Yêu cầu & Quyền lợi</span>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                Yêu cầu ứng viên (ngăn cách bởi dấu phẩy)
              </label>
              <textarea
                rows={2}
                value={form.requirements}
                onChange={e => setForm(prev => ({ ...prev, requirements: e.target.value }))}
                placeholder="Ví dụ: Nhanh nhẹn, đúng giờ, thái độ tốt, không yêu cầu kinh nghiệm..."
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 focus:border-purple-500 text-white text-xs focus:outline-none resize-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                Quyền lợi đãi ngộ (ngăn cách bởi dấu phẩy)
              </label>
              <textarea
                rows={2}
                value={form.benefits}
                onChange={e => setForm(prev => ({ ...prev, benefits: e.target.value }))}
                placeholder="Ví dụ: Bao ăn nhẹ giữa ca, giảm 50% menu đồ uống, thưởng chuyên cần..."
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 focus:border-purple-500 text-white text-xs focus:outline-none resize-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                Mô tả chi tiết công việc
              </label>
              <textarea
                rows={3}
                value={form.description}
                onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Mô tả công việc hàng ngày, quy trình làm việc, môi trường..."
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 focus:border-purple-500 text-white text-xs focus:outline-none resize-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                Hashtags từ khóa tìm kiếm (cách nhau bằng khoảng trắng)
              </label>
              <input
                type="text"
                value={form.hashtags}
                onChange={e => setForm(prev => ({ ...prev, hashtags: e.target.value }))}
                placeholder="#phucvu #parttime #caugiay #sinhvien"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 focus:border-purple-500 text-white text-xs focus:outline-none"
              />
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="pt-5 border-t border-slate-800 flex items-center justify-end gap-3 sticky bottom-0 bg-slate-900/95 py-2">
            <button
              type="button"
              onClick={() => setEditingJob(null)}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
            >
              Hủy bỏ
            </button>

            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-extrabold shadow-lg shadow-purple-600/30 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Lưu cập nhật</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
