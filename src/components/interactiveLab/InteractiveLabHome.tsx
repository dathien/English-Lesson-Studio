import React, {useEffect, useMemo, useState} from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Box,
  CheckCircle2,
  Compass,
  Download,
  Gamepad2,
  GitBranch,
  HardDrive,
  HelpCircle,
  Layers,
  MessageSquare,
  Mic,
  Search,
  Sparkles,
  Star,
} from 'lucide-react';
import type {HighSchoolGrade} from '../../types/lesson';
import type {
  GrammarSimulation,
  LabCategory,
  LabUserProgress,
  PronunciationSimulation,
  RolePlayScenario,
  UnitLabBundle,
} from '../../types/interactiveLab';
import {
  WORLD_3D_DEFINITIONS,
  TOTAL_3D_MISSIONS,
  getWorld3DByUnitId,
} from '../../engine3d/WorldMissions';
import {UNIT_LAB_BUNDLES, ALL_LAB_VOCAB} from '../../data/interactiveLab/SIMULATION_MANIFEST';
import {GRAMMAR_SIMULATIONS} from '../../data/interactiveLab/grammarSimulations';
import {PRONUNCIATION_SIMULATIONS} from '../../data/interactiveLab/pronunciationSimulations';
import {ROLEPLAY_SCENARIOS} from '../../data/interactiveLab/roleplayScenarios';
import {
  DEFAULT_LAB_PROGRESS,
  loadLabProgressFromDB,
  saveLabProgressToDB,
} from '../../services/storage';
import {InteractiveWorldWorkspace} from './InteractiveWorldWorkspace';
import {GrammarDynamicEngine} from './engines/GrammarDynamicEngine';
import {PronunciationLabEngine} from './engines/PronunciationLabEngine';
import {RolePlayEngine} from './engines/RolePlayEngine';
import {LabGuideModal} from './LabGuideModal';
import {LabOfflineManagerModal} from './LabOfflineManagerModal';
import {InsertToLessonModal} from './InsertToLessonModal';

interface InteractiveLabHomeProps {
  onFullscreenChange?: (isFull: boolean) => void;
}

type HubSection = 'worlds_3d' | 'units_2d' | 'grammar' | 'pronunciation' | 'roleplay';

type ActiveItem =
  | {kind: 'unit'; bundle: UnitLabBundle; initialMode: '3d' | '2d'}
  | {kind: 'grammar'; item: GrammarSimulation}
  | {kind: 'pronunciation'; item: PronunciationSimulation}
  | {kind: 'roleplay'; item: RolePlayScenario};

export const InteractiveLabHome: React.FC<InteractiveLabHomeProps> = ({
  onFullscreenChange,
}) => {
  const [section, setSection] = useState<HubSection>('worlds_3d');
  const [gradeFilter, setGradeFilter] = useState<'all' | HighSchoolGrade>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [activeItem, setActiveItem] = useState<ActiveItem | null>(null);
  const [accent, setAccent] = useState<'en-GB' | 'en-US'>('en-GB');
  const [progress, setProgress] = useState<LabUserProgress>(DEFAULT_LAB_PROGRESS);

  const [guideOpen, setGuideOpen] = useState(false);
  const [offlineOpen, setOfflineOpen] = useState(false);
  const [insertRef, setInsertRef] = useState<{
    simulationId: string;
    category: LabCategory;
    titleEn: string;
    titleVi: string;
    grade: HighSchoolGrade;
    unitId?: string;
    unitNumber?: number;
    summaryVi?: string;
  } | null>(null);

  useEffect(() => {
    loadLabProgressFromDB().then(setProgress);
  }, []);

  const recordRecent = (id: string) => {
    const nextRecent = [id, ...progress.recentIds.filter((r) => r !== id)].slice(0, 12);
    saveLabProgressToDB({...progress, recentIds: nextRecent}).then(setProgress);
  };

  const openUnit = (bundle: UnitLabBundle, initialMode: '3d' | '2d') => {
    recordRecent(bundle.unitId);
    setActiveItem({kind: 'unit', bundle, initialMode});
  };

  const openGrammar = (item: GrammarSimulation) => {
    recordRecent(item.id);
    setActiveItem({kind: 'grammar', item});
  };

  const openPronunciation = (item: PronunciationSimulation) => {
    recordRecent(item.id);
    setActiveItem({kind: 'pronunciation', item});
  };

  const openRolePlay = (item: RolePlayScenario) => {
    recordRecent(item.id);
    setActiveItem({kind: 'roleplay', item});
  };

  const q = searchQuery.trim().toLowerCase();

  const filteredWorlds3D = useMemo(() => {
    return WORLD_3D_DEFINITIONS.filter((w) => {
      if (gradeFilter !== 'all' && w.grade !== gradeFilter) return false;
      if (onlyFavorites && !progress.favorites.includes(w.unitId)) return false;
      if (
        q &&
        !`${w.titleEn} ${w.titleVi} ${w.subtitleVi} unit ${w.unitNumber} lớp ${w.grade}`
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [gradeFilter, onlyFavorites, progress.favorites, q]);

  const filteredUnits2D = useMemo(() => {
    return UNIT_LAB_BUNDLES.filter((u) => {
      if (gradeFilter !== 'all' && u.grade !== gradeFilter) return false;
      if (onlyFavorites && !progress.favorites.includes(u.unitId)) return false;
      if (
        q &&
        !`${u.titleEn} ${u.titleVi} unit ${u.unitNumber} lớp ${u.grade}`
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [gradeFilter, onlyFavorites, progress.favorites, q]);

  const filteredGrammar = useMemo(() => {
    return GRAMMAR_SIMULATIONS.filter((g) => {
      if (gradeFilter !== 'all' && !g.gradeFocus.includes(gradeFilter)) return false;
      if (q && !`${g.titleEn} ${g.titleVi} ${g.formulaEn}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [gradeFilter, q]);

  const filteredPronunciation = useMemo(() => {
    return PRONUNCIATION_SIMULATIONS.filter((p) => {
      if (gradeFilter !== 'all' && !p.gradeFocus.includes(gradeFilter)) return false;
      if (q && !`${p.titleEn} ${p.titleVi} ${p.objectiveVi}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [gradeFilter, q]);

  const filteredRolePlay = useMemo(() => {
    return ROLEPLAY_SCENARIOS.filter((r) => {
      if (gradeFilter !== 'all' && r.grade !== gradeFilter) return false;
      if (
        q &&
        !`${r.titleEn} ${r.titleVi} ${r.settingVi} unit ${r.unitNumber}`
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [gradeFilter, q]);

  // =========================================================================
  // ACTIVE ITEM VIEWS
  // =========================================================================
  if (activeItem?.kind === 'unit') {
    const worldDef = getWorld3DByUnitId(activeItem.bundle.unitId);
    return (
      <InteractiveWorldWorkspace
        bundle={activeItem.bundle}
        world3D={worldDef}
        initialMode={activeItem.initialMode}
        progress={progress}
        onUpdateProgress={setProgress}
        onBack={() => {
          onFullscreenChange?.(false);
          setActiveItem(null);
        }}
        onFullscreenChange={onFullscreenChange}
      />
    );
  }

  if (activeItem) {
    const titleEn = activeItem.item.titleEn;
    const titleVi = activeItem.item.titleVi;
    const gradeVal: HighSchoolGrade =
      activeItem.kind === 'roleplay'
        ? activeItem.item.grade
        : (activeItem.item.gradeFocus[0] ?? 10);

    return (
      <div className="mx-auto max-w-[1380px] space-y-5 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveItem(null)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-[15px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Quay lại danh mục
            </button>
            <div>
              <h1 className="text-[20px] font-bold text-slate-900">{titleEn}</h1>
              <p className="text-[15px] text-slate-600">{titleVi}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAccent((a) => (a === 'en-GB' ? 'en-US' : 'en-GB'))}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-[14px] font-bold text-blue-700 hover:bg-blue-50"
            >
              Giọng: {accent === 'en-GB' ? 'Anh–Anh (UK)' : 'Anh–Mỹ (US)'}
            </button>
            <button
              type="button"
              onClick={() =>
                setInsertRef({
                  simulationId: activeItem.item.id,
                  category: activeItem.kind,
                  titleEn,
                  titleVi,
                  grade: gradeVal,
                  unitId:
                    activeItem.kind === 'roleplay' ? activeItem.item.unitId : undefined,
                  unitNumber:
                    activeItem.kind === 'roleplay' ? activeItem.item.unitNumber : undefined,
                })
              }
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-[15px] font-semibold text-white hover:bg-blue-700"
            >
              <Layers className="h-4 w-4" />
              Chèn vào bài giảng
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {activeItem.kind === 'grammar' && (
            <GrammarDynamicEngine grammar={activeItem.item} accent={accent} />
          )}
          {activeItem.kind === 'pronunciation' && (
            <PronunciationLabEngine simulation={activeItem.item} accent={accent} />
          )}
          {activeItem.kind === 'roleplay' && (
            <RolePlayEngine scenario={activeItem.item} accent={accent} />
          )}
        </div>

        {insertRef && (
          <InsertToLessonModal
            open={true}
            onClose={() => setInsertRef(null)}
            simulationRef={insertRef}
          />
        )}
      </div>
    );
  }

  // =========================================================================
  // MAIN INTERACTIVE WORLD 2D/3D HUB
  // =========================================================================
  return (
    <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 sm:px-6">
      {/* Hero Banner */}
      <section className="relative overflow-hidden rounded-3xl border border-blue-200/80 bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900 p-6 text-white shadow-lg sm:p-8">
        <div className="relative z-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="max-w-2xl space-y-2.5">
            <div className="inline-flex items-center gap-2 rounded-lg bg-white/15 px-3 py-1 text-[14px] font-semibold text-blue-100">
              <Compass className="h-4 w-4" />
              English Interactive World 2D/3D · THPT 10 · 11 · 12
            </div>
            <h1 className="text-[26px] font-extrabold leading-tight tracking-tight sm:text-[32px]">
              Không gian học Tiếng Anh tương tác 2D/3D
            </h1>
            <p className="text-[16px] leading-relaxed text-blue-100">
              Khám phá – Tương tác – Thực hành – Vận dụng với <strong>15 Không gian 3D tương tác trực tiếp</strong> ({TOTAL_3D_MISSIONS} nhiệm vụ thực hành có trình tự),{' '}
              <strong>30 Hoạt động 2D đủ 30 Unit THPT</strong>, <strong>20 Ngữ pháp động</strong>,{' '}
              <strong>12 Phát âm 2D/3D</strong> và <strong>30 Tình huống nhập vai</strong>.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => setOfflineOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/15 px-4 py-2.5 text-[15px] font-semibold text-white hover:bg-white/25"
            >
              <Download className="h-4 w-4" />
              Quản lý gói Offline
            </button>
            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-[15px] font-bold text-blue-900 shadow-sm hover:bg-blue-50"
            >
              <HelpCircle className="h-4 w-4" />
              Hướng dẫn & Đối soát
            </button>
          </div>
        </div>

        {/* Summary KPI strip */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            {label: 'Không gian 3D', value: `${WORLD_3D_DEFINITIONS.length} Unit`, sub: `${TOTAL_3D_MISSIONS} nhiệm vụ thực hành`},
            {label: 'Hoạt động 2D', value: `${UNIT_LAB_BUNDLES.length} Unit`, sub: 'Đủ Lớp 10 · 11 · 12'},
            {label: 'Từ vựng trực quan', value: `${ALL_LAB_VOCAB.length} từ`, sub: 'IPA + phát âm UK/US'},
            {label: 'Ngữ pháp & Phát âm', value: `${GRAMMAR_SIMULATIONS.length + PRONUNCIATION_SIMULATIONS.length}`, sub: '20 Ngữ pháp · 12 Phát âm'},
            {label: 'Tình huống Role-Play', value: `${ROLEPLAY_SCENARIOS.length}`, sub: 'Hội thoại rẽ nhánh'},
          ].map((k) => (
            <div
              key={k.label}
              className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3"
            >
              <div className="text-[13px] font-medium text-blue-100">{k.label}</div>
              <div className="mt-0.5 text-[22px] font-extrabold text-white">{k.value}</div>
              <div className="text-[12px] text-blue-200">{k.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Primary Section Tabs + Filters */}
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['worlds_3d', `Không gian 3D (${WORLD_3D_DEFINITIONS.length})`, Box],
              ['units_2d', `Hoạt động 2D (${UNIT_LAB_BUNDLES.length} Unit)`, Layers],
              ['grammar', `Ngữ pháp động (${GRAMMAR_SIMULATIONS.length})`, GitBranch],
              ['pronunciation', `Phát âm 2D/3D (${PRONUNCIATION_SIMULATIONS.length})`, Mic],
              ['roleplay', `Nhập vai Role-Play (${ROLEPLAY_SCENARIOS.length})`, MessageSquare],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[15px] font-semibold transition-colors ${
                section === id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            {(['all', 10, 11, 12] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGradeFilter(g)}
                className={`rounded-lg px-3.5 py-1.5 text-[14px] font-semibold transition-colors ${
                  gradeFilter === g
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {g === 'all' ? 'Tất cả khối lớp' : `Lớp ${g}`}
              </button>
            ))}

            {(section === 'worlds_3d' || section === 'units_2d') && (
              <button
                type="button"
                onClick={() => setOnlyFavorites((f) => !f)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[14px] font-semibold ${
                  onlyFavorites
                    ? 'border-amber-300 bg-amber-50 text-amber-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Star className={`h-4 w-4 ${onlyFavorites ? 'fill-amber-400 text-amber-500' : ''}`} />
                Yêu thích ({progress.favorites.length})
              </button>
            )}
          </div>

          <div className="relative min-w-[260px] flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm Unit, chủ đề, kỹ năng..."
              className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* =====================================================================
          SECTION 1: 15 INTERACTIVE 3D WORLDS (75 MISSIONS)
         ===================================================================== */}
      {section === 'worlds_3d' && (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredWorlds3D.map((w) => {
            const bundle = UNIT_LAB_BUNDLES.find((b) => b.unitId === w.unitId)!;
            const isCompleted = progress.completedIds.includes(w.unitId);
            const isFav = progress.favorites.includes(w.unitId);

            return (
              <article
                key={w.unitId}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-lg bg-blue-100 px-2.5 py-1 text-[13px] font-bold text-blue-800">
                      Lớp {w.grade} · Unit {w.unitNumber}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {isCompleted && (
                        <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-emerald-700">
                          <CheckCircle2 className="h-4 w-4" />
                          Hoàn thành
                        </span>
                      )}
                      {isFav && <Star className="h-4 w-4 fill-amber-400 text-amber-500" />}
                    </div>
                  </div>

                  <h2 className="mt-3 text-[18px] font-bold leading-snug text-slate-900">
                    {w.titleEn}
                  </h2>
                  <p className="mt-0.5 text-[15px] font-semibold text-blue-700">{w.titleVi}</p>
                  <p className="mt-2 text-[14px] leading-relaxed text-slate-600">
                    {w.subtitleVi}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3 text-[13px] font-medium text-slate-700">
                    <span className="inline-flex items-center gap-1 text-emerald-800">
                      <Gamepad2 className="h-4 w-4 text-emerald-600" />
                      {w.missions.length} nhiệm vụ
                    </span>
                    <span>·</span>
                    <span>{w.objects.length} vật thể 3D</span>
                    {w.hasDragDrop && (
                      <>
                        <span>·</span>
                        <span className="text-blue-700">Kéo thả 3D</span>
                      </>
                    )}
                    {w.hasCharacter && (
                      <>
                        <span>·</span>
                        <span className="text-indigo-700">Nhân vật di chuyển</span>
                      </>
                    )}
                    {w.hasPianoOrInstruments && (
                      <>
                        <span>·</span>
                        <span className="text-violet-700">Nhạc cụ âm thanh</span>
                      </>
                    )}
                    {w.hasRobotControls && (
                      <>
                        <span>·</span>
                        <span className="text-amber-800">Robot 4-DOF</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => openUnit(bundle, '3d')}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-[15px] font-semibold text-white hover:bg-blue-700"
                  >
                    <Box className="h-4 w-4" />
                    Mở Không gian 3D
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openUnit(bundle, '2d')}
                    className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-[14px] font-semibold text-slate-700 hover:bg-slate-50"
                    title="Mở phiên bản hoạt động 2D"
                  >
                    2D
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* =====================================================================
          SECTION 2: ALL 30 UNITS 2D INTERACTIVE ACTIVITIES
         ===================================================================== */}
      {section === 'units_2d' && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredUnits2D.map((bundle) => {
            const has3D = Boolean(getWorld3DByUnitId(bundle.unitId));
            return (
              <article
                key={bundle.unitId}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[13px] font-bold text-slate-800">
                      Lớp {bundle.grade} · Unit {bundle.unitNumber}
                    </span>
                    {has3D && (
                      <span className="rounded-lg bg-emerald-100 px-2 py-0.5 text-[12px] font-bold text-emerald-800">
                        Có Không gian 3D
                      </span>
                    )}
                  </div>
                  <h2 className="mt-2.5 text-[17px] font-bold text-slate-900">{bundle.titleEn}</h2>
                  <p className="text-[15px] text-slate-600">{bundle.titleVi}</p>
                  <div className="mt-2.5 flex flex-wrap gap-2 text-[13px] text-slate-600">
                    <span className="inline-flex items-center gap-1">
                      <BookOpen className="h-3.5 w-3.5 text-blue-600" />
                      {bundle.vocab.length} từ vựng
                    </span>
                    <span>·</span>
                    <span>4 kỹ năng L–S–R–W</span>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => openUnit(bundle, '2d')}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-[15px] font-semibold text-white hover:bg-slate-800"
                  >
                    <Layers className="h-4 w-4" />
                    Mở Hoạt động 2D
                  </button>
                  {has3D && (
                    <button
                      type="button"
                      onClick={() => openUnit(bundle, '3d')}
                      className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-3.5 py-2.5 text-[14px] font-semibold text-white hover:bg-blue-700"
                    >
                      <Box className="h-4 w-4" />
                      3D
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* =====================================================================
          SECTION 3: 20 DYNAMIC GRAMMAR SIMULATIONS
         ===================================================================== */}
      {section === 'grammar' && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredGrammar.map((g) => (
            <article
              key={g.id}
              className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-lg bg-indigo-100 px-2.5 py-1 text-[13px] font-bold text-indigo-800">
                    {g.id} · Lớp {g.gradeFocus.join(' · ')}
                  </span>
                  <span className="text-[13px] font-semibold text-slate-500">
                    {g.exercises.length} câu tập
                  </span>
                </div>
                <h2 className="mt-2.5 text-[17px] font-bold text-slate-900">{g.titleEn}</h2>
                <p className="text-[15px] font-medium text-indigo-700">{g.titleVi}</p>
                <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 font-mono text-[13px] text-slate-800">
                  {g.formulaEn}
                </div>
              </div>
              <button
                type="button"
                onClick={() => openGrammar(g)}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-[15px] font-semibold text-white hover:bg-indigo-700"
              >
                <Sparkles className="h-4 w-4" />
                Mở mô phỏng Ngữ pháp
              </button>
            </article>
          ))}
        </div>
      )}

      {/* =====================================================================
          SECTION 4: 12 PRONUNCIATION 2D/3D LABS
         ===================================================================== */}
      {section === 'pronunciation' && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredPronunciation.map((p) => (
            <article
              key={p.id}
              className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-lg bg-rose-100 px-2.5 py-1 text-[13px] font-bold text-rose-800">
                    {p.id} · Lớp {p.gradeFocus.join(' · ')}
                  </span>
                  <span className="text-[13px] font-semibold text-slate-500">
                    2D + 3D Khẩu hình
                  </span>
                </div>
                <h2 className="mt-2.5 text-[17px] font-bold text-slate-900">{p.titleEn}</h2>
                <p className="text-[15px] font-medium text-rose-700">{p.titleVi}</p>
                <p className="mt-1.5 text-[14px] text-slate-600">{p.objectiveVi}</p>
              </div>
              <button
                type="button"
                onClick={() => openPronunciation(p)}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-[15px] font-semibold text-white hover:bg-rose-700"
              >
                <Mic className="h-4 w-4" />
                Mở Phòng luyện Phát âm
              </button>
            </article>
          ))}
        </div>
      )}

      {/* =====================================================================
          SECTION 5: 30 ROLE-PLAY SCENARIOS
         ===================================================================== */}
      {section === 'roleplay' && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredRolePlay.map((r) => (
            <article
              key={r.id}
              className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-lg bg-emerald-100 px-2.5 py-1 text-[13px] font-bold text-emerald-800">
                    Lớp {r.grade} · Unit {r.unitNumber}
                  </span>
                  <span className="text-[13px] font-semibold text-slate-500">
                    {r.nodes.length} lượt thoại
                  </span>
                </div>
                <h2 className="mt-2.5 text-[17px] font-bold text-slate-900">{r.titleEn}</h2>
                <p className="text-[15px] font-medium text-emerald-800">{r.titleVi}</p>
                <p className="mt-1.5 text-[14px] text-slate-600">{r.settingVi}</p>
              </div>
              <button
                type="button"
                onClick={() => openRolePlay(r)}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-[15px] font-semibold text-white hover:bg-emerald-700"
              >
                <MessageSquare className="h-4 w-4" />
                Bắt đầu nhập vai
              </button>
            </article>
          ))}
        </div>
      )}

      {/* Modals */}
      <LabGuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />
      <LabOfflineManagerModal isOpen={offlineOpen} onClose={() => setOfflineOpen(false)} />
      {insertRef && (
        <InsertToLessonModal
          open={true}
          onClose={() => setInsertRef(null)}
          simulationRef={insertRef}
        />
      )}
    </div>
  );
};

export default InteractiveLabHome;
