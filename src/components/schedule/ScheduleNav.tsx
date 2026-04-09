"use client"
import { ChevronLeft, ChevronRight, CalendarDays, ChevronDown, PlusCircle, X, Trash2 } from 'lucide-react';
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
  onOpenTutorModal: () => void;
  onOpenEnrollModal: () => void;
  bulkRemoveMode?: boolean;
  selectedBulkCount?: number;
  isBulkRemoving?: boolean;
  onToggleBulkRemoveMode?: () => void;
  onBulkRemove?: () => void;
  onClearBulkSelection?: () => void;
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
  onOpenTutorModal,
  onOpenEnrollModal,
  bulkRemoveMode,
  selectedBulkCount = 0,
  isBulkRemoving,
  onToggleBulkRemoveMode,
  onBulkRemove,
  onClearBulkSelection,
  commandBarSlot,
}: ScheduleNavProps) {
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
            <div className="w-full flex items-center justify-center gap-2 pointer-events-auto">
              {commandBarSlot}
            </div>
          </div>
        )}

        <div className="flex-1 min-w-0" />

        {/* AI command bar stays inline below xl to avoid overlapping nav controls */}
        {commandBarSlot && (
          <div className="flex xl:hidden items-center gap-2 shrink-0">
            {commandBarSlot}
          </div>
        )}

        {!todayView && onToggleBulkRemoveMode && onBulkRemove && (
          <>
            <button
              onClick={onToggleBulkRemoveMode}
              className="w-7 h-7 md:w-auto md:h-auto md:px-2.5 md:py-1.5 flex items-center justify-center md:gap-1 rounded-lg text-xs font-semibold transition-all shrink-0"
              style={{ background: bulkRemoveMode ? '#312e81' : 'white', border: '1px solid #a5b4fc', color: bulkRemoveMode ? 'white' : '#4f46e5' }}>
              <Trash2 size={12} />
              <span className="hidden md:inline">{bulkRemoveMode ? 'Exit Remove' : 'Bulk Remove'}</span>
            </button>
            {bulkRemoveMode && (
              <>
                <button
                  onClick={onBulkRemove}
                  disabled={!selectedBulkCount || !!isBulkRemoving}
                  className="w-7 h-7 md:w-auto md:h-auto md:px-2.5 md:py-1.5 flex items-center justify-center md:gap-1 rounded-lg text-xs font-bold transition-all shrink-0"
                  style={{
                    background: selectedBulkCount ? '#4f46e5' : '#eef2ff',
                    border: '1px solid #a5b4fc',
                    color: selectedBulkCount ? 'white' : '#818cf8',
                    cursor: selectedBulkCount ? 'pointer' : 'not-allowed',
                  }}>
                  <Trash2 size={12} />
                  <span className="hidden md:inline">{isBulkRemoving ? 'Removing…' : `Delete ${selectedBulkCount}`}</span>
                </button>
                {!!selectedBulkCount && onClearBulkSelection && (
                  <button
                    onClick={onClearBulkSelection}
                    className="hidden md:inline text-[10px] font-bold uppercase tracking-wider shrink-0"
                    style={{ color: '#4f46e5' }}>
                    Clear
                  </button>
                )}
              </>
            )}
          </>
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

        <button onClick={onOpenTutorModal}
          className="w-7 h-7 md:w-auto md:h-auto md:px-2.5 md:py-1.5 flex items-center justify-center md:gap-1 rounded-lg text-xs font-semibold transition-all shrink-0"
          style={{ background: 'white', border: '1px solid #a5b4fc', color: '#4f46e5' }}>
          <PlusCircle size={12} />
          <span className="hidden md:inline">Tutors</span>
        </button>
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