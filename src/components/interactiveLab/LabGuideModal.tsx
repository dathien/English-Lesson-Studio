import React, {useMemo, useState} from 'react';
import {
  BookOpen,
  Box,
  CheckCircle2,
  ClipboardCheck,
  Compass,
  Gamepad2,
  Layers,
  X,
} from 'lucide-react';
import {WORLD_3D_DEFINITIONS, TOTAL_3D_MISSIONS} from '../../engine3d/WorldMissions';
import {SIMULATIONS_2D} from '../../data/interactiveLab/simulations2D';
import {GRAMMAR_SIMULATIONS} from '../../data/interactiveLab/grammarSimulations';
import {PRONUNCIATION_SIMULATIONS} from '../../data/interactiveLab/pronunciationSimulations';
import {ROLEPLAY_SCENARIOS} from '../../data/interactiveLab/roleplayScenarios';
import {ALL_LAB_VOCAB} from '../../data/interactiveLab/SIMULATION_MANIFEST';

interface LabGuideModalProps {
  open: boolean;
  onClose: () => void;
}

export const LabGuideModal: React.FC<LabGuideModalProps> = ({open, onClose}) => {
  const [tab, setTab] = useState<'guide' | 'audit'>('guide');

  const auditSummary = useMemo(() => {
    const g10Worlds = WORLD_3D_DEFINITIONS.filter((w) => w.grade === 10).length;
    const g11Worlds = WORLD_3D_DEFINITIONS.filter((w) => w.grade === 11).length;
    const g12Worlds = WORLD_3D_DEFINITIONS.filter((w) => w.grade === 12).length;
    return {
      total3D: WORLD_3D_DEFINITIONS.length,
      g10Worlds,
      g11Worlds,
      g12Worlds,
      totalMissions: TOTAL_3D_MISSIONS,
      total2D: SIMULATIONS_2D.length,
      totalGrammar: GRAMMAR_SIMULATIONS.length,
      totalPron: PRONUNCIATION_SIMULATIONS.length,
      totalRolePlay: ROLEPLAY_SCENARIOS.length,
      totalVocab: ALL_LAB_VOCAB.length,
    };
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
              <Compass className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-[18px] font-bold text-slate-900">
                Hướng dẫn sử dụng & Kiểm định Thế giới Tiếng Anh 2D/3D
              </h2>
              <p className="text-[14px] text-slate-600">
                15 Không gian 3D tương tác · {auditSummary.totalMissions} Nhiệm vụ thực hành · 30 Hoạt động 2D THPT
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-2 border-b border-slate-200 bg-slate-50 px-6 py-2.5">
          <button
            type="button"
            onClick={() => setTab('guide')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[15px] font-semibold transition-colors ${
              tab === 'guide'
                ? 'bg-blue-600 text-white'
                : 'text-slate-700 hover:bg-slate-200/70'
            }`}
          >
            <BookOpen className="h-4 w-4" />
            Hướng dẫn dạy & học nhanh
          </button>
          <button
            type="button"
            onClick={() => setTab('audit')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[15px] font-semibold transition-colors ${
              tab === 'audit'
                ? 'bg-blue-600 text-white'
                : 'text-slate-700 hover:bg-slate-200/70'
            }`}
          >
            <ClipboardCheck className="h-4 w-4" />
            Bảng đối soát 15 Không gian 3D & 30 Unit 2D
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'guide' ? (
            <div className="space-y-5 text-[15px] leading-relaxed text-slate-800">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="mb-2 flex items-center gap-2 font-bold text-blue-800">
                    <Box className="h-5 w-5" />
                    1. Thao tác trực tiếp trong Không gian 3D
                  </div>
                  <ul className="list-disc space-y-1.5 pl-5 text-slate-700">
                    <li>Giữ chuột trái kéo để xoay góc nhìn; cuộn con lăn để phóng to/thu nhỏ; chuột phải để dịch chuyển.</li>
                    <li>Bấm trực tiếp vào đồ vật hoặc nhãn nổi 3D để mở các hành động thực tế (mở cửa, gạt công tắc, lắp ráp, chơi nhạc cụ...).</li>
                    <li>Với các bài có kéo thả 3D (Lớp 10 Unit 1, 2, 5): kéo trực tiếp đồ vật và thả vào vòng tròn màu xanh lá trên đích đến.</li>
                    <li>Với các bài có nhân vật di chuyển (Lớp 10 Unit 10, Lớp 11 Unit 6, Lớp 12 Unit 2, 8): dùng phím W/A/S/D, mũi tên hoặc cụm phím điều hướng trên màn hình.</li>
                  </ul>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="mb-2 flex items-center gap-2 font-bold text-emerald-800">
                    <Gamepad2 className="h-5 w-5" />
                    2. Ba chế độ học & Chuỗi nhiệm vụ Tiếng Anh
                  </div>
                  <ul className="list-disc space-y-1.5 pl-5 text-slate-700">
                    <li><strong>Khám phá (Explore):</strong> Tự do thử nghiệm mọi vật thể, nghe phát âm Anh–Anh / Anh–Mỹ và quan sát cơ chế phản ứng.</li>
                    <li><strong>Thực hành (Practice):</strong> Hoàn thành từng nhiệm vụ theo đúng trình tự thao tác tiếng Anh, có gợi ý và dịch song ngữ.</li>
                    <li><strong>Thử thách (Challenge):</strong> Hoàn thành chuỗi nhiệm vụ có tính điểm và đồng hồ đếm giờ (tắt gợi ý mặc định).</li>
                    <li>Nhấn <strong>2D ↔ 3D</strong> bất cứ lúc nào để chuyển sang hoạt động 2D tương ứng của cùng Unit trên máy cấu hình yếu.</li>
                  </ul>
                </div>
              </div>

              <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4">
                <div className="mb-2 flex items-center gap-2 font-bold text-blue-900">
                  <Layers className="h-5 w-5" />
                  3. Tích hợp trọn vẹn vào Bài giảng & Ngân hàng Đề thi
                </div>
                <p className="text-slate-700">
                  Mỗi không gian đều có nút <strong>Chèn vào bài giảng</strong> (chạy trực tiếp ngay trong trình chiếu lớp học),
                  <strong> Đẩy câu hỏi sang Ngân hàng đề thi</strong>, <strong>Tải gói dùng Offline</strong> và tab{' '}
                  <strong>Chỉnh sửa (Giáo viên)</strong> sử dụng trình soạn thảo trực quan WYSIWYG.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  {label: 'Không gian 3D', val: `${auditSummary.total3D} Unit`, sub: `L10:${auditSummary.g10Worlds} · L11:${auditSummary.g11Worlds} · L12:${auditSummary.g12Worlds}`},
                  {label: 'Nhiệm vụ 3D', val: `${auditSummary.totalMissions}`, sub: '5 nhiệm vụ / Unit'},
                  {label: 'Hoạt động 2D', val: `${auditSummary.total2D} Unit`, sub: 'Đủ 30 Unit THPT'},
                  {label: 'Ngữ pháp động', val: `${auditSummary.totalGrammar}`, sub: '100 câu luyện tập'},
                  {label: 'Phát âm 2D/3D', val: `${auditSummary.totalPron}`, sub: '12 cặp tối thiểu'},
                  {label: 'Từ vựng & Role-Play', val: `${auditSummary.totalVocab}`, sub: `${auditSummary.totalRolePlay} tình huống`},
                ].map((stat) => (
                  <div key={stat.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                    <div className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">
                      {stat.label}
                    </div>
                    <div className="mt-1 text-[20px] font-bold text-blue-700">{stat.val}</div>
                    <div className="text-[12px] text-slate-600">{stat.sub}</div>
                  </div>
                ))}
              </div>

              <div>
                <h3 className="mb-3 text-[16px] font-bold text-slate-900">
                  Danh sách 15 Không gian 3D tương tác chuyên sâu (THPT 10 · 11 · 12)
                </h3>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full border-collapse text-left text-[14px]">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                        <th className="px-3.5 py-2.5 font-semibold">Lớp / Unit</th>
                        <th className="px-3.5 py-2.5 font-semibold">Không gian 3D</th>
                        <th className="px-3.5 py-2.5 font-semibold">Cơ chế tương tác</th>
                        <th className="px-3.5 py-2.5 text-center font-semibold">Vật thể</th>
                        <th className="px-3.5 py-2.5 text-center font-semibold">Nhiệm vụ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {WORLD_3D_DEFINITIONS.map((w) => (
                        <tr key={w.unitId} className="hover:bg-slate-50">
                          <td className="whitespace-nowrap px-3.5 py-2.5 font-semibold text-blue-700">
                            Lớp {w.grade} · Unit {w.unitNumber}
                          </td>
                          <td className="px-3.5 py-2.5">
                            <div className="font-semibold text-slate-900">{w.titleEn}</div>
                            <div className="text-[13px] text-slate-500">{w.titleVi}</div>
                          </td>
                          <td className="px-3.5 py-2.5 text-[13px] text-slate-700">
                            {[
                              w.hasCharacter ? 'Nhân vật di chuyển' : null,
                              w.hasDragDrop ? 'Kéo thả 3D' : null,
                              w.hasPianoOrInstruments ? 'Nhạc cụ phát âm thanh' : null,
                              w.hasRobotControls ? 'Khớp Robot 4 bậc tự do' : null,
                              !w.hasCharacter && !w.hasDragDrop && !w.hasPianoOrInstruments && !w.hasRobotControls
                                ? 'Bấm tương tác & biến đổi trạng thái'
                                : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </td>
                          <td className="px-3.5 py-2.5 text-center font-semibold text-slate-700">
                            {w.objects.length}
                          </td>
                          <td className="px-3.5 py-2.5 text-center">
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                              <CheckCircle2 className="h-4 w-4" />
                              {w.missions.length}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
