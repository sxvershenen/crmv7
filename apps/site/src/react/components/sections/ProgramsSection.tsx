import React, { useState } from 'react';
import { Sparkles, ArrowRight, ArrowUpRight, Filter, ChevronDown, Clock, Calendar, Users } from 'lucide-react';
import { POPULAR_PROGRAMS, PROGRAM_CATEGORIES, ProgramItem } from '../../data/resortData';

interface ProgramsSectionProps {
  onOpenBookingModal: (programTitle?: string) => void;
}

export const ProgramsSection: React.FC<ProgramsSectionProps> = ({ onOpenBookingModal }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'default' | 'duration'>('default');
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(4);

  const filteredPrograms = POPULAR_PROGRAMS.filter((p) => {
    if (selectedCategory === 'all') return true;
    return p.category === selectedCategory;
  });

  const sortedPrograms = [...filteredPrograms].sort((a, b) => {
    if (sortBy === 'duration') {
      return a.duration.localeCompare(b.duration);
    }
    return 0;
  });

  const displayedPrograms = sortedPrograms.slice(0, visibleCount);

  return (
    <section id="programs" className="w-full py-8">
      {/* Block Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-[10px] font-semibold tracking-wider uppercase text-[#18191b] mb-2.5">
            <Sparkles className="w-3 h-3 text-[#FAAB2B]" />
            Команда «Зажигай»
          </div>

          <div className="flex flex-col md:flex-row md:items-end gap-2 md:gap-4">
            <h2 className="text-[26px] sm:text-[32px] font-semibold text-[#18191b] leading-tight tracking-tight">
              Программы и сценарии
            </h2>
            <p className="hidden md:block text-[13px] text-[#6b7280] max-w-md font-normal leading-relaxed">
              80+ авторских квестов, тимбилдингов и&nbsp;шоу-программ с&nbsp;профессиональными ведущими
            </p>
          </div>
        </div>

        {/* Right Sort Dropdown */}
        <div className="relative shrink-0">
          <button
            onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
            className="h-[40px] px-4 rounded-full bg-white text-[#18191b] text-[13px] font-medium inline-flex items-center gap-2 hover:bg-neutral-100 transition-colors"
          >
            <Filter className="w-4 h-4 text-[#FAAB2B]" />
            <span className="hidden sm:inline">
              {sortBy === 'default' ? 'По популярности' : 'По длительности'}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 text-neutral-400 transition-transform ${sortDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {sortDropdownOpen && (
            <div className="absolute right-0 top-[46px] w-48 bg-white rounded-2xl p-2 border border-neutral-200 shadow-xl z-30 animate-in fade-in zoom-in-95 duration-150">
              <button
                onClick={() => {
                  setSortBy('default');
                  setSortDropdownOpen(false);
                }}
                className={`w-full text-left p-2 rounded-xl text-[12px] font-medium transition-colors ${
                  sortBy === 'default' ? 'bg-[#f7f7f7] text-[#2B9E47]' : 'text-[#18191b] hover:bg-[#f7f7f7]'
                }`}
              >
                По популярности
              </button>
              <button
                onClick={() => {
                  setSortBy('duration');
                  setSortDropdownOpen(false);
                }}
                className={`w-full text-left p-2 rounded-xl text-[12px] font-medium transition-colors ${
                  sortBy === 'duration' ? 'bg-[#f7f7f7] text-[#2B9E47]' : 'text-[#18191b] hover:bg-[#f7f7f7]'
                }`}
              >
                По длительности
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Grid: Left Programs Listing / Right 4 Square Categories (Top on Mobile) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Right Section Cards (4 cards 2x2 grid) - Shown first on mobile */}
        <div className="order-1 lg:order-2 lg:col-span-5">
          <div className="grid grid-cols-2 gap-3">
            {PROGRAM_CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;

              return (
                <div
                  key={cat.id}
                  onClick={() => setSelectedCategory(isSelected ? 'all' : cat.id)}
                  className={`relative aspect-square rounded-3xl overflow-hidden cursor-pointer group p-3.5 flex flex-col justify-between transition-all ${
                    isSelected ? 'ring-2 ring-[#2B9E47]' : ''
                  }`}
                >
                  <img
                    src={cat.photo}
                    alt={cat.title}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/20" />

                  {/* Top: arrow pill */}
                  <div className="relative z-10 flex justify-end">
                    <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-xs group-hover:bg-white text-white group-hover:text-[#18191b] flex items-center justify-center transition-colors">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  {/* Bottom: Title & Count */}
                  <div className="relative z-10 text-white">
                    <div className="text-[14px] sm:text-[15px] font-semibold leading-tight">
                      {cat.title}
                    </div>
                    <div className="text-[11px] text-neutral-300 mt-1 font-medium">
                      {cat.countText}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {selectedCategory !== 'all' && (
            <button
              onClick={() => setSelectedCategory('all')}
              className="mt-3 w-full h-[36px] rounded-full bg-white text-[#18191b] text-[12px] font-medium flex items-center justify-center gap-1.5 hover:bg-neutral-100 transition-colors"
            >
              <span>Показать все направления</span>
            </button>
          )}
        </div>

        {/* Left Section: Popular Programs Horizontal Cards (Order 2 on Mobile) */}
        <div className="order-2 lg:order-1 lg:col-span-7 space-y-3">
          {displayedPrograms.map((prog: ProgramItem) => (
            <div
              key={prog.id}
              onClick={() => onOpenBookingModal(`Программа: ${prog.title}`)}
              className="p-3 rounded-3xl bg-white flex flex-col sm:flex-row items-center gap-4 cursor-pointer group transition-transform"
            >
              {/* 1:1 Preview Photo with 8-12px padding look */}
              <div className="relative w-full sm:w-28 h-28 shrink-0 rounded-2xl overflow-hidden bg-neutral-100">
                <img
                  src={prog.photo}
                  alt={prog.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-[10px] font-medium text-white">
                  {prog.categoryLabel}
                </span>
              </div>

              {/* Information */}
              <div className="flex-1 w-full flex flex-col justify-between">
                <div>
                  <h3 className="text-[15px] font-semibold text-[#18191b] group-hover:text-[#2B9E47] transition-colors leading-snug">
                    {prog.title}
                  </h3>
                  <p className="text-[12px] text-[#6b7280] mt-1 line-clamp-2 leading-relaxed">
                    {prog.description}
                  </p>
                </div>

                {/* Mini-bubbles: age, season, duration */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#f7f7f7] text-[11px] text-[#6b7280] font-medium">
                    <Users className="w-3 h-3 text-[#2B9E47]" />
                    {prog.age}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#f7f7f7] text-[11px] text-[#6b7280] font-medium">
                    <Calendar className="w-3 h-3 text-[#FAAB2B]" />
                    {prog.season}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#f7f7f7] text-[11px] text-[#6b7280] font-medium">
                    <Clock className="w-3 h-3 text-[#18191b]" />
                    {prog.duration}
                  </span>
                </div>
              </div>

              {/* Right arrow pill */}
              <div className="w-8 h-8 rounded-full bg-[#f7f7f7] group-hover:bg-[#2B9E47] group-hover:text-white flex items-center justify-center text-[#18191b] transition-colors shrink-0 self-end sm:self-center">
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          ))}

          {/* Toggle All Programs Button */}
          {visibleCount < sortedPrograms.length ? (
            <button
              onClick={() => setVisibleCount(sortedPrograms.length)}
              className="w-full h-[42px] rounded-full bg-white hover:bg-neutral-200 text-[#18191b] text-[13px] font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <span>Все программы ({sortedPrograms.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : sortedPrograms.length > 4 ? (
            <button
              onClick={() => setVisibleCount(4)}
              className="w-full h-[38px] rounded-full bg-white hover:bg-neutral-200 text-[#6b7280] text-[12px] font-medium flex items-center justify-center transition-colors"
            >
              Свернуть список
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
};
