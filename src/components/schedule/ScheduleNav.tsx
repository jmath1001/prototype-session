"use client"
import { ChevronLeft, ChevronRight, CalendarDays, ChevronDown, PlusCircle, X, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { type Tutor } from '@/lib/useScheduleData';
import { formatWeekRange } from './scheduleConstants';

interface ScheduleNavProps {
  todayView: boolean;
  setTodayView: (v: boolean) => void;
  weekStart: Date;
  isCurrentWeek: boolean;
  goToPrevWeek: () => void;
  goToNextWeek: () => void;
  goToThisWeek: () => void;
  tutors: Tutor[];
  selectedTutorFilter: string | null;
  setSelectedTutorFilter: (v: string | null) => void;
  onOpenEnrollModal: () => void;
  bulkRemoveMode?: boolean;
  selectedBulkCount?: number;
  isBulkRemoving?: boolean;
  onToggleBulkRemoveMode?: () => void;
  onBulkRemove?: () => void;
  onClearBulkSelection?: () => void;
  onClearWeekNonRecurring?: () => void;
  isClearingWeek?: boolean;
  commandBarSlot?: React.ReactNode;
}

export function ScheduleNav({
  todayView,
  setTodayView,
  weekStart,
  isCurrentWeek,
  goToPrevWeek,
  goToNextWeek,
  goToThisWeek,
  tutors,
  selectedTutorFilter,
  setSelectedTutorFilter,
  onOpenEnrollModal,
  bulkRemoveMode,
  selectedBulkCount = 0,
  isBulkRemoving,
  onToggleBulkRemoveMode,
  onBulkRemove,
  onClearBulkSelection,
  onClearWeekNonRecurring,
  isClearingWeek,
  commandBarSlot,
}: ScheduleNavProps) {
  const [clearMenuOpen, setClearMenuOpen] = useState(false);

  return (
    <div className="sticky top-0 z-30 border-b"
      style={{ background: 'rgba(255,255,255,0.98)', backdropFilter: 'blur(16px)', borderColor: '#e0e7ff' }}>
      <div className="mx-auto px-2 md:px-6 h-10 md:h-11 relative flex items-center gap-1.5 md:gap-2" style={{ maxWidth: 1600 }}>
          {/* Week/Today toggle */}
          <div className="flex gap-0.5 p-0.5 rounded-lg shrink-0" style={{ background: '#e0e7ff' }}>
            <button onClick={() => setTodayView(false)}
              className="px-2 md:px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all"
              style={!todayView ? { background: 'white', color: '#4f46e5', boxShadow: '0 1px 3px rgba(79,70,229,0.15)' } : { color: '#818cf8' }}>
              Week
            </button>
            <button onClick={() => setTodayView(true)}
              className="px-2 md:px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all"
              style={todayView ? { background: '#4f46e5', color: 'white', boxShadow: '0 1px 3px rgba(79,70,229,0.3)' } : { color: '#818cf8' }}>
              Today
            </button>
          </div>

          {/* Week navigator */}
          {!todayView && (
            <>
              <div className="w-px h-5 shrink-0 hidden md:block" style={{ background: '#a5b4fc' }} />
              <button onClick={goToPrevWeek} className="w-6 h-6 md:w-7 md:h-7 rounded-lg flex items-center justify-center transition-all shrink-0"
                style={{ background: 'white', border: '1px solid #a5b4fc', color: '#4f46e5' }}>
                <ChevronLeft size={12} />
              </button>
              <div className="hidden sm:flex flex-col items-center shrink-0">
                <div className="text-xs font-bold leading-none" style={{ color: '#111827', fontFamily: 'ui-serif, Georgia, serif' }}>{formatWeekRange(weekStart)}</div>
                {isCurrentWeek && <div className="text-[8px] font-bold uppercase tracking-widest mt-0.5" style={{ color: '#4f46e5' }}>This Week</div>}
              </div>
              <button onClick={goToNextWeek} className="w-6 h-6 md:w-7 md:h-7 rounded-lg flex items-center justify-center transition-all shrink-0"
                style={{ background: 'white', border: '1px solid #a5b4fc', color: '#4f46e5' }}>
                <ChevronRight size={12} />
              </button>
              {!isCurrentWeek && (
                <button onClick={goToThisWeek}
                  className="flex items-center gap-1 px-1.5 py-1 rounded-lg text-[9px] font-bold uppercase transition-all shrink-0"
                  style={{ background: '#e0e7ff', border: '1px solid #a5b4fc', color: '#4f46e5' }}>
                  <CalendarDays size={9} />
                  <span className="hidden sm:inline">Now</span>
                </button>
              )}
            </>
          )}

        {commandBarSlot && (
          <div className="absolute left-1/2 top-1/2 hidden xl:flex w-full -translate-x-1/2 -translate-y-1/2 justify-center px-4 pointer-events-none" style={{ maxWidth: 620 }}>
            <div
              className="w-full flex items-center justify-center gap-2 pointer-events-auto rounded-lg px-1.5 py-1"
              style={{
                maxWidth: 560,
                background: 'linear-gradient(120deg, rgba(79,70,229,0.12) 0%, rgba(129,140,248,0.16) 52%, rgba(224,231,255,0.9) 100%)',
                border: '1px solid #c7d2fe',
                boxShadow: '0 6px 14px rgba(79,70,229,0.12)',
              }}
            >
              {commandBarSlot}
            </div>
          </div>
        )}

        <div className="flex-1 min-w-0" />

        {/* Assistant command bar stays inline below xl to avoid overlapping nav controls */}
        {commandBarSlot && (
          <div
            className="hidden lg:flex xl:hidden items-center gap-2 shrink-0 rounded-lg px-1.5 py-1"
            style={{
              background: 'linear-gradient(120deg, rgba(79,70,229,0.12) 0%, rgba(129,140,248,0.16) 52%, rgba(224,231,255,0.9) 100%)',
              border: '1px solid #c7d2fe',
              boxShadow: '0 6px 14px rgba(79,70,229,0.1)',
            }}
          >
            {commandBarSlot}
          </div>
        )}

        {!todayView && onToggleBulkRemoveMode && onBulkRemove && onClearWeekNonRecurring && (
          <div className="relative shrink-0">
            <button
              onClick={() => setClearMenuOpen(v => !v)}
              disabled={!!isClearingWeek || !!isBulkRemoving}
              className="w-7 h-7 md:w-auto md:h-auto md:px-2.5 md:py-1.5 flex items-center justify-center md:gap-1 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: bulkRemoveMode ? '#312e81' : 'white',
                border: `1px solid ${bulkRemoveMode ? '#312e81' : '#fca5a5'}`,
                color: bulkRemoveMode ? 'white' : '#b91c1c',
                cursor: (isClearingWeek || isBulkRemoving) ? 'not-allowed' : 'pointer',
              }}>
              <Trash2 size={12} />
              <span className="hidden md:inline">
                {bulkRemoveMode ? `Bulk Remove (${selectedBulkCount})` : (isClearingWeek ? 'Clearing…' : 'Clear')}
              </span>
              <ChevronDown size={12} />
            </button>

            {clearMenuOpen && (
              <div className="absolute right-0 mt-1 z-40 rounded-lg overflow-hidden"
                style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 8px 24px rgba(15,23,42,0.16)', minWidth: 180 }}>
                <button
                  onClick={() => { setClearMenuOpen(false); onClearWeekNonRecurring(); }}
                  disabled={!!isClearingWeek}
                  className="w-full text-left px-3 py-2 text-xs font-semibold"
                  style={{ color: '#b91c1c', background: 'white', borderBottom: '1px solid #f1f5f9' }}>
                  {isClearingWeek ? 'Clearing Week…' : 'Clear Week'}
                </button>

                <button
                  onClick={() => { setClearMenuOpen(false); onToggleBulkRemoveMode(); }}
                  className="w-full text-left px-3 py-2 text-xs font-semibold"
                  style={{ color: bulkRemoveMode ? '#312e81' : '#334155', background: 'white', borderBottom: bulkRemoveMode ? '1px solid #f1f5f9' : 'none' }}>
                  {bulkRemoveMode ? 'Exit Bulk Remove' : 'Enter Bulk Remove'}
                </button>

                {bulkRemoveMode && (
                  <>
                    <button
                      onClick={() => { setClearMenuOpen(false); onBulkRemove(); }}
                      disabled={!selectedBulkCount || !!isBulkRemoving}
                      className="w-full text-left px-3 py-2 text-xs font-bold"
                      style={{
                        color: selectedBulkCount ? '#4f46e5' : '#94a3b8',
                        background: 'white',
                        borderBottom: !!selectedBulkCount ? '1px solid #f1f5f9' : 'none',
                        cursor: selectedBulkCount ? 'pointer' : 'not-allowed',
                      }}>
                      {isBulkRemoving ? 'Removing…' : `Delete Selected (${selectedBulkCount})`}
                    </button>

                    {!!selectedBulkCount && onClearBulkSelection && (
                      <button
                        onClick={() => { setClearMenuOpen(false); onClearBulkSelection(); }}
                        className="w-full text-left px-3 py-2 text-xs font-semibold"
                        style={{ color: '#475569', background: 'white' }}>
                        Clear Selection
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

          <div className="w-px h-5 shrink-0" style={{ background: '#a5b4fc' }} />

          {/* Tutor filter */}
          <div className="relative shrink-0">
            <select
              value={selectedTutorFilter ?? ''}
              onChange={e => setSelectedTutorFilter(e.target.value || null)}
              className="appearance-none pl-2 pr-6 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wider cursor-pointer"
              style={{
                background: selectedTutorFilter ? '#eef2ff' : 'white',
                border: `1px solid ${selectedTutorFilter ? '#a5b4fc' : '#e5e7eb'}`,
                color: selectedTutorFilter ? '#4f46e5' : '#6b7280',
                outline: 'none', maxWidth: 110,
              }}>
              <option value="">All Tutors</option>
              {tutors.map(t => <option key={t.id} value={t.id}>{t.name.split(' ')[0]}</option>)}
            </select>
            <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: selectedTutorFilter ? '#4f46e5' : '#818cf8' }} />
          </div>
          {selectedTutorFilter && (
            <button onClick={() => setSelectedTutorFilter(null)}
              className="w-5 h-5 md:w-6 md:h-6 rounded-md flex items-center justify-center shrink-0"
              style={{ background: '#e0e7ff', border: '1px solid #a5b4fc', color: '#4f46e5' }}>
              <X size={9} />
            </button>
          )}

          <div className="w-px h-5 shrink-0" style={{ background: '#a5b4fc' }} />

        <button onClick={onOpenEnrollModal}
          className="w-7 h-7 md:w-auto md:h-auto md:px-3 md:py-1.5 flex items-center justify-center md:gap-1 rounded-lg text-xs font-bold text-white transition-all active:scale-95 shrink-0"
          style={{ background: '#4f46e5', boxShadow: '0 1px 4px rgba(79,70,229,0.35)' }}>
          <PlusCircle size={12} />
          <span className="hidden md:inline">Book</span>
        </button>
      </div>
    </div>
  );
}