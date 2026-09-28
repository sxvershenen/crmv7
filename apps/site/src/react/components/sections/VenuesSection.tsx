import React, { useState } from 'react';
import { Layers, Users } from 'lucide-react';
import type { CmsHomeSectionConfig, PublicVenueSummary } from '@crm/contracts';
import { VENUES, VenueItem } from '../../data/resortData';
import { useSwipeHint } from '../../utils/useSwipeHint';
import { EmptyState, SiteActionSectionHeader, SiteFilterMenu, SiteResponsiveRail, SiteVenueCard } from '@crm/site-ui';

interface VenuesSectionProps {
  config: CmsHomeSectionConfig;
  published?: PublicVenueSummary[] | undefined;
  fixture?: boolean | undefined;
  onOpenBookingModal: (venueTitle?: string) => void;
}

export const VenuesSection: React.FC<VenuesSectionProps> = ({ config, onOpenBookingModal, published = [], fixture = false }) => {
  const swiperRef = useSwipeHint();
  const [capacityFilter, setCapacityFilter] = useState<'all' | 'small' | 'medium' | 'large'>('all');
  const [formatFilter, setFormatFilter] = useState<'all' | 'indoor' | 'outdoor'>('all');
  const [dropdownOpen, setDropdownOpen] = useState<'capacity' | 'format' | null>(null);

  const venues: VenueItem[] = fixture ? VENUES : published.filter((item) => item.requestAvailable).map((item) => ({
    id: item.offeringId, title: item.title, capacity: `до ${item.fulfillment.capacityTotal} гостей`, capacityNumber: item.fulfillment.capacityTotal,
    shortDesc: item.summary ?? "", photo: "", suitableFor: [], area: "", features: [],
  }))
  const filteredVenues = venues.filter((venue) => {
    const capacityOk = capacityFilter === 'small' ? venue.capacityNumber <= 30 : capacityFilter === 'medium' ? venue.capacityNumber > 30 && venue.capacityNumber <= 70 : capacityFilter === 'large' ? venue.capacityNumber > 70 : true;
    const spaceType = fixture ? (['banquet-hall', 'yurt'].includes(venue.id) ? 'indoor' : 'outdoor') : published.find((item) => item.offeringId === venue.id)?.fulfillment.spaceType;
    const formatOk = formatFilter === 'all' || spaceType === formatFilter || spaceType === 'mixed';
    return capacityOk && formatOk;
  });

  if (!venues.length) return <section id="venues" data-section-key="venues" data-analytics-id="home.venues.view" className="w-full py-8"><SiteActionSectionHeader eyebrow={config.eyebrow ?? undefined} title={config.title} description={config.description || undefined} action={null} /><EmptyState title="Пока нет доступных площадок" description="Новые площадки появятся здесь, когда будет открыта запись." /></section>
  return (
    <section id="venues" data-section-key="venues" data-analytics-id="home.venues.view" className="w-full py-8">
      <SiteActionSectionHeader
        eyebrow={config.eyebrow ?? undefined}
        title={config.title}
        description={config.description || undefined}
        action={<div className="flex items-center gap-2"><SiteFilterMenu
          width="md"
          label={capacityFilter === 'all' ? `Все площадки (${venues.length})` : capacityFilter === 'small' ? 'До 30 гостей' : capacityFilter === 'medium' ? 'От 30 до 70 гостей' : 'От 70 до 300 гостей'}
          icon={<Users className="w-4 h-4 text-[var(--site-color-text-muted)]" />}
          open={dropdownOpen === 'capacity'}
          onToggle={() => setDropdownOpen((value) => value === 'capacity' ? null : 'capacity')}
          options={[
            { id: 'all', label: 'Любое число', selected: capacityFilter === 'all', onSelect: () => { setCapacityFilter('all'); setDropdownOpen(null); } },
            { id: 'small', label: 'До 30', selected: capacityFilter === 'small', onSelect: () => { setCapacityFilter('small'); setDropdownOpen(null); } },
            { id: 'medium', label: 'До 70', selected: capacityFilter === 'medium', onSelect: () => { setCapacityFilter('medium'); setDropdownOpen(null); } },
            { id: 'large', label: 'От 70', selected: capacityFilter === 'large', onSelect: () => { setCapacityFilter('large'); setDropdownOpen(null); } },
          ]}
        /><SiteFilterMenu width="md" label={formatFilter === 'all' ? 'Любой формат' : formatFilter === 'indoor' ? 'В помещении' : 'На улице'} icon={<Layers className="w-4 h-4 text-[var(--site-color-text-muted)]" />} open={dropdownOpen === 'format'} onToggle={() => setDropdownOpen((value) => value === 'format' ? null : 'format')} options={[{ id: 'all', label: 'Любой формат', selected: formatFilter === 'all', onSelect: () => { setFormatFilter('all'); setDropdownOpen(null); } }, { id: 'indoor', label: 'В помещении', selected: formatFilter === 'indoor', onSelect: () => { setFormatFilter('indoor'); setDropdownOpen(null); } }, { id: 'outdoor', label: 'На улице', selected: formatFilter === 'outdoor', onSelect: () => { setFormatFilter('outdoor'); setDropdownOpen(null); } }]} /></div>}
      />

      {/* 5 Cards Row on Desktop / Swiper on Mobile */}
      <SiteResponsiveRail ref={swiperRef} variant="venues">
        {filteredVenues.map((venue: VenueItem) => (
          <SiteVenueCard
            key={venue.id}
            onSelect={() => onOpenBookingModal(`Площадка: ${venue.title}`)}
            image={venue.photo}
            title={venue.title}
            area={venue.area}
            capacity={venue.capacityNumber}
            description={venue.shortDesc}
            tags={venue.suitableFor}
          />
        ))}
      </SiteResponsiveRail>
    </section>
  );
};
