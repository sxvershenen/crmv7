import React, { useState } from 'react';
import { ArrowUpDown } from 'lucide-react';
import type { CmsHomeSectionConfig } from '@crm/contracts';
import { POPULAR_PROGRAMS, PROGRAM_CATEGORIES, ProgramItem } from '../../data/resortData';
import { Pagination, SiteActionSectionHeader, SiteFilterMenu, SiteImageCategoryCard, SiteProgramFeatureCard, SiteSecondaryAction } from '@crm/site-ui';

interface ProgramsSectionProps {
  config: CmsHomeSectionConfig;
  onOpenBookingModal: (programTitle?: string) => void;
}

export const ProgramsSection: React.FC<ProgramsSectionProps> = ({ config, onOpenBookingModal }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sort, setSort] = useState<'popular' | 'name' | 'short'>('popular');
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [showAll, setShowAll] = useState(false);

  const filteredPrograms = POPULAR_PROGRAMS.filter((p) => {
    if (selectedCategory === 'all') return true;
    return p.category === selectedCategory;
  }).sort((a, b) => sort === 'name' ? a.title.localeCompare(b.title, 'ru') : sort === 'short' ? parseFloat(a.duration) - parseFloat(b.duration) : POPULAR_PROGRAMS.indexOf(a) - POPULAR_PROGRAMS.indexOf(b));

  const pageSize = 4;
  const pageCount = Math.max(1, Math.ceil(filteredPrograms.length / pageSize));
  const displayedPrograms = showAll ? filteredPrograms : filteredPrograms.slice((page - 1) * pageSize, page * pageSize);
  const sortLabel = sort === 'name' ? 'По названию' : sort === 'short' ? 'Сначала короткие' : 'По популярности';

  return (
    <section id="programs" data-section-key="programs" data-analytics-id="home.programs.view" className="w-full py-8">
      <SiteActionSectionHeader eyebrow={config.eyebrow ?? undefined} title={config.title} description={config.description || undefined} action={<SiteFilterMenu label={sortLabel} icon={<ArrowUpDown className="w-4 h-4 text-[var(--site-color-text-muted)]" />} open={sortDropdownOpen} onToggle={() => setSortDropdownOpen(!sortDropdownOpen)} options={[{ id: 'popular', label: 'По популярности', selected: sort === 'popular', onSelect: () => { setSort('popular'); setPage(1); setSortDropdownOpen(false); } }, { id: 'name', label: 'По названию', selected: sort === 'name', onSelect: () => { setSort('name'); setPage(1); setSortDropdownOpen(false); } }, { id: 'short', label: 'Сначала короткие', selected: sort === 'short', onSelect: () => { setSort('short'); setPage(1); setSortDropdownOpen(false); } }]} />} />

      {/* Main Grid: Left Programs Listing / Right 4 Square Categories (Top on Mobile) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Right Section Cards (4 cards 2x2 grid) - Shown first on mobile */}
        <div className="lg:col-span-5">
          <div className="grid grid-cols-2 gap-3">
            {PROGRAM_CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;

              return (
                <SiteImageCategoryCard
                  key={cat.id}
                  onSelect={() => { setSelectedCategory(isSelected ? 'all' : cat.id); setPage(1); setShowAll(false); }}
                  selected={isSelected}
                  image={cat.photo}
                  title={cat.title}
                />
              );
            })}
          </div>

          {selectedCategory !== 'all' && (
            <button
              onClick={() => setSelectedCategory('all')}
              className="mt-3 w-full h-9 rounded-[var(--site-radius-round)] bg-[var(--site-color-surface)] text-[var(--site-color-text)] text-[length:var(--site-text-caption)] font-[var(--site-weight-medium)] flex items-center justify-center gap-1.5 hover:bg-[var(--site-color-control-hover)] transition-colors"
            >
              <span>Показать все направления</span>
            </button>
          )}
        </div>

        {/* Left Section: Popular Programs Horizontal Cards (Order 2 on Mobile) */}
        <div className="lg:col-span-7 space-y-3">
          {displayedPrograms.map((prog: ProgramItem) => (
            <SiteProgramFeatureCard
              key={prog.id}
              onSelect={() => onOpenBookingModal(`Программа: ${prog.title}`)}
              image={prog.photo}
              title={prog.title}
              description={prog.description}
              age={prog.age}
              season={prog.season}
              duration={prog.duration}
            />
          ))}

          <div className="flex items-center justify-between gap-3 pt-1">
            <Pagination variant="feature" current={showAll ? 0 : page} total={pageCount} onPageChange={(pageNumber) => { setPage(pageNumber); setShowAll(false); }} />
            <SiteSecondaryAction onClick={() => { setSelectedCategory('all'); setPage(1); setShowAll(true); }}>Все программы</SiteSecondaryAction>
          </div>
        </div>
      </div>
    </section>
  );
};
