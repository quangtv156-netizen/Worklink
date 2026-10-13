import React from 'react';
import { X, ShieldCheck, FileText } from 'lucide-react';

/**
 * Modal hiển thị Điều khoản dịch vụ và Chính sách bảo mật (O7 & Compliance)
 */
export default function LegalModal({ isOpen, onClose, defaultTab = 'terms' }) {
  const [tab, setTab] = React.useState(defaultTab);

  React.useEffect(() => {
    if (defaultTab) setTab(defaultTab);
  }, [defaultTab]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
              {tab === 'terms' ? <FileText className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
            </div>
            <h3 className="text-base font-bold text-white">
              {tab === 'terms' ? 'Điều khoản Dịch vụ WorkLink' : 'Chính sách Bảo mật & Quyền riêng tư'}
            </h3>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 p-1">
          <button
            onClick={() => setTab('terms')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              tab === 'terms' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Điều khoản Dịch vụ
          </button>
          <button
            onClick={() => setTab('privacy')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              tab === 'privacy' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Chính sách Bảo mật (GDPR/PDPA)
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-300 leading-relaxed">
          {tab === 'terms' ? (
            <>
              <h4 className="text-sm font-semibold text-white">1. Chấp thuận Điều khoản</h4>
              <p>
                Khi đăng ký hoặc sử dụng nền tảng WorkLink, bạn đồng ý tuân thủ toàn bộ quy định và quy chế hoạt động được nêu tại văn bản này. Nếu không đồng ý, vui lòng ngừng sử dụng dịch vụ.
              </p>

              <h4 className="text-sm font-semibold text-white">2. Quy định dành cho Nhà tuyển dụng</h4>
              <p>
                Nhà tuyển dụng cam kết thông tin tuyển dụng là chính xác, không đăng tin việc làm giả mạo, thu phí ứng viên trái phép hoặc phát tán nội dung lừa đảo. Mọi tin đăng đều chịu sự kiểm duyệt của Ban Quản trị.
              </p>

              <h4 className="text-sm font-semibold text-white">3. Quy định dành cho Ứng viên</h4>
              <p>
                Ứng viên chịu trách nhiệm về tính trung thực của hồ sơ cá nhân và tệp CV tải lên. Nghiêm cấm sử dụng tài khoản để spam tin nhắn, quấy rối hoặc vi phạm quyền lợi của người khác.
              </p>

              <h4 className="text-sm font-semibold text-white">4. Xử lý Vi phạm</h4>
              <p>
                WorkLink có quyền tạm khóa hoặc chấm dứt vĩnh viễn tài khoản của bất kỳ thành viên nào có hành vi vi phạm pháp luật hoặc điều khoản dịch vụ mà không cần báo trước.
              </p>
            </>
          ) : (
            <>
              <h4 className="text-sm font-semibold text-white">1. Thu thập và Mục đích Sử dụng Dữ liệu</h4>
              <p>
                Chúng tôi chỉ thu thập các thông tin cần thiết (họ tên, email, số điện thoại, CV, kỹ năng) nhằm mục đích kết nối việc làm thông minh qua trợ lý AI và tối ưu trải nghiệm người dùng.
              </p>

              <h4 className="text-sm font-semibold text-white">2. Quyền Kiểm soát Dữ liệu của Người dùng (GDPR)</h4>
              <p>
                - <strong>Quyền Tải xuống dữ liệu (Data Portability):</strong> Bạn có thể xuất toàn bộ dữ liệu cá nhân bất kỳ lúc nào tại mục Cài đặt tài khoản.
                <br />
                - <strong>Quyền được Quên (Right to be Forgotten):</strong> Bạn có quyền tự xóa vĩnh viễn tài khoản và toàn bộ lịch sử ứng tuyển, tin nhắn của mình.
              </p>

              <h4 className="text-sm font-semibold text-white">3. Bảo vệ Hồ sơ CV & Tệp đính kèm</h4>
              <p>
                Các tệp CV tải lên máy chủ được kiểm soát phân quyền nghiêm ngặt: Chỉ có bạn và Nhà tuyển dụng của tin bạn nộp đơn mới có quyền truy cập tệp CV này.
              </p>

              <h4 className="text-sm font-semibold text-white">4. Cam kết Không Bán Dữ liệu</h4>
              <p>
                WorkLink cam kết không bán hoặc chia sẻ thông tin cá nhân của bạn cho bên thứ ba vì mục đích tiếp thị hoặc thương mại khi chưa có sự đồng ý rõ ràng.
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer"
          >
            Tôi đã hiểu & Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
