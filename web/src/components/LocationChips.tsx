import { LOCATIONS } from '../constants.ts';

interface Props {
  selected: string[];
  onToggle: (abbr: string) => void;
}

export default function LocationChips({ selected, onToggle }: Props) {
  return (
    <div className="chips">
      {LOCATIONS.map((loc) => {
        const active = selected.includes(loc.abbr);
        return (
          <button
            key={loc.abbr}
            className={`chip ${active ? 'chip-active' : ''}`}
            style={{
              backgroundColor: active ? loc.color : '#fff',
              color: active ? '#fff' : loc.color,
              borderColor: loc.color,
            }}
            onClick={() => onToggle(loc.abbr)}
          >
            {loc.name}
          </button>
        );
      })}
    </div>
  );
}
