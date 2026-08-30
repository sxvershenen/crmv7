import React, { useState } from 'react';
import { Sparkles, ArrowRight, Filter, ChevronDown, Clock, Calendar, Users } from 'lucide-react';
import { POPULAR_PROGRAMS, PROGRAM_CATEGORIES, ProgramItem } from '../../data/resortData';

interface ProgramsSectionProps {
  onOpenBookingModal: (programTitle?: string) => void;
}

export const ProgramsSection: React.FC<ProgramsSectionProps> = ({ onOpenBookingModal }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [showAll, setShowAll] = useState(false);

  const filteredPrograms = POPULAR_PROGRAMS.filter((p) => {
    if (selectedCategory === 'all') return true;
    return p.category === selectedCategory;
  });

  const pageSize = 4;
  const pageCount = Math.max(1, Math.ceil(filteredPrograms.length / pageSize));
  const displayedPrograms = showAll ? filteredPrograms : filteredPrograms.slice((page - 1) * pageSize, page * pageSize);
  const activeCategoryLabel = selectedCategory === 'all'
    ? 'Все категории'
    : PROGRAM_CATEGORIES.find((category) => category.id === selectedCategory)?.title ?? 'Все категории';

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
            <span className="hidden sm:inline">{activeCategoryLabel}</span>
            <ChevronDown className={`w-3.5 h-3.5 text-neutral-400 transition-transform ${sortDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {sortDropdownOpen && (
            <div className="absolute right-0 top-[46px] w-48 bg-white rounded-2xl p-2 border border-neutral-200 shadow-xl z-30 animate-in fade-in zoom-in-95 duration-150">
              <button onClick={() => { setSelectedCategory('all'); setPage(1); setShowAll(false); setSortDropdownOpen(false); }} className={`w-full text-left p-2 rounded-xl text-[12px] font-medium transition-colors ${selectedCategory === 'all' ? 'bg-[#f7f7f7] text-[#2B9E47]' : 'text-[#18191b] hover:bg-[#f7f7f7]'}`}>Все категории</button>
              {PROGRAM_CATEGORIES.map((category) => (
                <button key={category.id} onClick={() => { setSelectedCategory(category.id); setPage(1); setShowAll(false); setSortDropdownOpen(false); }} className={`w-full text-left p-2 rounded-xl text-[12px] font-medium transition-colors ${selectedCategory === category.id ? 'bg-[#f7f7f7] text-[#2B9E47]' : 'text-[#18191b] hover:bg-[#f7f7f7]'}`}>{category.title}</button>
              ))}
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
                  onClick={() => { setSelectedCategory(isSelected ? 'all' : cat.id); setPage(1); setShowAll(false); }}
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

                  {/* Bottom: Title & Count */}
                  <div className="relative z-10 mt-auto text-white">
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
              className="relative p-3 pr-14 rounded-3xl bg-white flex flex-col sm:flex-row items-center gap-4 cursor-pointer group transition-transform"
            >
              {/* 1:1 Preview Photo with 8-12px padding look */}
              <div className="relative w-full sm:w-28 h-28 shrink-0 rounded-2xl overflow-hidden bg-neutral-100">
                <img
                  src={prog.photo}
                  alt={prog.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
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
              <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-[#f7f7f7] group-hover:bg-[#2B9E47] group-hover:text-white flex items-center justify-center text-[#18191b] transition-colors shrink-0">
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-1.5" aria-label="Пагинация программ">
              {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
                <button key={pageNumber} onClick={() => { setPage(pageNumber); setShowAll(false); }} className={`w-9 h-9 rounded-full text-[12px] font-semibold transition-colors ${page === pageNumber && !showAll ? 'bg-[#2B9E47] text-white' : 'bg-white text-[#18191b] hover:bg-neutral-100'}`}>{pageNumber}</button>
              ))}
            </div>
            <button onClick={() => { setSelectedCategory('all'); setPage(1); setShowAll(true); }} className="h-[48px] px-5 rounded-full bg-white hover:bg-neutral-200 text-[#18191b] text-[13px] font-medium inline-flex items-center gap-2 transition-colors">
              <span>Все программы</span><ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
