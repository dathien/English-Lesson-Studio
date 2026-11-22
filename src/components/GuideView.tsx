import React from 'react';
import {
  BookOpen,
  FileDown,
  FileUp,
  Headphones,
  Layers,
  Mic,
  MonitorPlay,
  PenTool,
  WifiOff,
} from 'lucide-react';

export const GuideView: React.FC = () => {
  const sections = [
    {
      icon: FileUp,
      title: '01. Tải tài liệu DOCX, PDF hoặc ảnh chụp thành bài trình chiếu',
      steps: [
        'Tại Trang chủ, kéo thả tệp Word (.docx), PDF hoặc chọn cùng lúc nhiều ảnh JPG/PNG/WebP.',
        'Chọn khối lớp (10, 11, 12) và kỹ năng ưu tiên (hoặc để tự động nhận diện).',
        'Ở Bước 3 (Kiểm tra nội dung), kiểm tra các câu được đánh dấu "Cần kiểm tra", xác nhận phần gạch chân phát âm <u>...</u> và đáp án trước khi nhấn "Tạo bài trình chiếu".',
        'Với tệp DOCX, phần chữ gạch chân và đoạn văn đọc hiểu gốc được trích xuất trực tiếp ngoại tuyến mà không cần AI.',
      ],
    },
    {
      icon: Layers,
      title: '02. Biên tập bài giảng 3 khung trực quan',
      steps: [
        'Cột trái: Thêm slide theo mẫu kỹ năng, nhân bản, xóa và kéo thả thay đổi thứ tự slide.',
        'Khung giữa: Sửa trực tiếp tiêu đề, hướng dẫn và xem trước nội dung slide theo thời gian thực.',
        'Cột phải: Công cụ chỉnh sửa thay đổi theo từng đối tượng đang chọn (Slide, Câu hỏi, Bài đọc, Âm thanh, Từ vựng IPA, Speaking, Writing, Ảnh/Video).',
        'Sử dụng Hoàn tác (Undo) / Làm lại (Redo) và bấm "Lưu bài" để lưu cục bộ vào IndexedDB.',
      ],
    },
    {
      icon: MonitorPlay,
      title: '03. Trình chiếu tương tác 16:9 trên máy chiếu & TV',
      steps: [
        'Sử dụng phím mũi tên Trái / Phải hoặc nút Previous / Next để chuyển slide.',
        'Đáp án KHÔNG tự động lộ khi mở slide — giáo viên chủ động bấm "Check Answer", "Show Answer", "Show Explanation" đúng thời điểm.',
        'Chuyển nhanh chế độ "Máy chiếu tương phản cao" hoặc tăng cỡ chữ A+ khi dạy phòng rộng.',
        'Mở đồng hồ Timer cho hoạt động thảo luận nhóm và bật Notes để xem gợi ý giảng dạy.',
      ],
    },
    {
      icon: Headphones,
      title: '04. Dạy học đủ 4 kỹ năng & Vocabulary – Grammar – Pronunciation',
      steps: [
        'Listening: Mở bài mẫu nghe ngay không cần tải tệp; hỗ trợ đủ 3 nguồn âm thanh (Bài nghe có sẵn, Tải âm thanh MP3/WAV riêng, Tạo giọng đọc Anh-Anh/Anh-Mỹ từ transcript), tốc độ 0.8× / 1× / 1.15×, ẩn/hiện transcript và đồng bộ mốc thời gian câu hỏi.',
        'Speaking: Luyện phát âm theo IPA, ghi âm giọng nói bằng micro, nghe lại bản ghi và chấm theo 6 tiêu chí (Pronunciation, Fluency, Vocabulary, Grammar, Interaction, Task Achievement).',
        'Reading: Đoạn văn gốc giữ nguyên bên trái (có chế độ mở rộng và tô sáng dẫn chứng), câu hỏi chùm đi kèm bên phải.',
        'Writing: Khung soạn thảo đếm từ tự động, gợi ý dàn ý, lưu bài viết vào IndexedDB, hỗ trợ nhận xét lỗi ngữ pháp/từ vựng (không viết bài thay học sinh).',
      ],
    },
    {
      icon: FileDown,
      title: '05. Xuất Word, PDF, PowerPoint & Lưu trữ dự án',
      steps: [
        'Xuất Word (.docx): Giữ nguyên đoạn văn, đánh số câu hỏi, gạch chân phát âm và kèm bảng đáp án cuối trang.',
        'Xuất PowerPoint (.pptx): Khổ 16:9 kèm nội dung, hình ảnh và ghi chú đáp án trong Presenter Notes. Lưu ý: các tương tác web như kéo thả/ghi âm chạy đầy đủ khi trình chiếu trực tiếp trên ứng dụng web.',
        'Xuất PDF / In bài tập: Tạo bản in A4 rõ nét trực tiếp từ trình duyệt.',
        'Xuất / Nhập tệp .ess.json để chia sẻ bài giảng giữa các máy tính của tổ chuyên môn.',
      ],
    },
    {
      icon: WifiOff,
      title: '06. Cài đặt ứng dụng PWA & Dạy học ngoại tuyến (Offline)',
      steps: [
        'Bấm nút "Cài đặt ứng dụng" trên thanh công cụ hoặc trong Cài đặt để cài lên Windows / macOS qua Chrome hoặc Edge.',
        'Khi mất mạng trên lớp: mở bài đã lưu, chỉnh sửa, trình chiếu 16:9, làm bài tập tương tác, phát file âm thanh đã gắn và ghi âm đều hoạt động bình thường.',
        'Các tác vụ AI trực tuyến (OCR ảnh/PDF scan, nhận xét Writing bằng AI, tạo câu hỏi AI từ transcript) sẽ tự thông báo khi không có mạng.',
      ],
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
      <div className="border-b border-slate-200 pb-5">
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
          Hướng dẫn sử dụng English Lesson Studio
        </h1>
        <p className="text-base text-[#475569] mt-1.5">
          Quy trình thao tác nhanh, trực quan dành cho giáo viên Tiếng Anh THPT lớp 10, 11, 12.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {sections.map((sec) => {
          const Icon = sec.icon;
          return (
            <section
              key={sec.title}
              className="edtech-card rounded-[18px] border border-slate-200/90 bg-white p-6 space-y-3.5 shadow-[0_4px_18px_-6px_rgba(15,23,42,0.06)]"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <h2 className="font-bold text-lg text-[#0F172A] leading-snug pt-0.5">{sec.title}</h2>
              </div>
              <ul className="list-disc pl-5 space-y-2 text-[15px] text-[#475569] leading-relaxed">
                {sec.steps.map((s, idx) => (
                  <li key={idx}>{s}</li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <div className="rounded-[18px] border border-slate-200/90 bg-white p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4 text-[15px] text-[#0F172A] shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <span>
            Phím tắt khi trình chiếu: <strong className="font-mono-tabular text-[#2563EB]">← / →</strong> chuyển slide ·{' '}
            <strong className="font-mono-tabular text-[#2563EB]">Esc</strong> thoát chế độ trình chiếu.
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-[#475569]">
          <Mic className="w-4 h-4 text-[#2563EB]" />
          <PenTool className="w-4 h-4 text-[#10B981]" />
          <span>Tương thích máy tính, bảng tương tác, máy chiếu &amp; điện thoại</span>
        </div>
      </div>
    </div>
  );
};
