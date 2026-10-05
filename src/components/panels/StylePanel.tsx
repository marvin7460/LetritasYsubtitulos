import { Smile } from 'lucide-react';
import type { ReactNode } from 'react';
import { parseColor } from '../../lib/export/ass';
import { FONTS, nearestWeight } from '../../lib/render/fonts';
import { PRESETS } from '../../lib/render/presets';
import type { CaptionStyle } from '../../lib/render/style';
import { applyPreset, setRules, setStyle, useEditor } from '../../state/editor';
import { useAppStore } from '../../state/store';

export function StylePanel() {
  const style = useAppStore((s) => s.doc?.style);
  const rules = useAppStore((s) => s.doc?.rules);
  const showSafeZones = useEditor((s) => s.showSafeZones);
  if (!style || !rules) return null;
  const font = FONTS.find((f) => f.family === style.fontFamily) ?? FONTS[0];

  return (
    <div className="max-h-[62vh] space-y-5 overflow-y-auto pr-1" data-testid="style-panel">
      <Section title="Estilos">
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              data-testid={`preset-${preset.id}`}
              aria-pressed={style.presetId === preset.id}
              onClick={() => applyPreset(preset.id)}
              className={`rounded-xl border p-3 text-left transition ${
                style.presetId === preset.id
                  ? 'border-brand bg-brand/10'
                  : 'border-line bg-surface-2/50 hover:border-muted'
              }`}
            >
              <PresetSwatch style={preset.style} label={preset.name} />
              <span className="mt-1 block text-[11px] leading-snug text-muted">
                {preset.description}
              </span>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted">
          Al elegir un estilo se reagrupan las palabras (TikTok muestra 3 a la vez). Ctrl+Z lo
          deshace.
        </p>
      </Section>

      <Section title="Texto">
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Select
            label="Fuente"
            value={style.fontFamily}
            onChange={(fontFamily) =>
              setStyle({ fontFamily, fontWeight: nearestWeight(fontFamily, style.fontWeight) })
            }
            options={FONTS.map((f) => ({ value: f.family, label: f.family }))}
          />
          <Select
            label="Grosor"
            value={String(style.fontWeight)}
            onChange={(w) => setStyle({ fontWeight: Number(w) })}
            options={(font?.weights ?? [400]).map((w) => ({ value: String(w), label: String(w) }))}
          />
        </div>
        <Slider
          label="Tamaño"
          value={style.fontSize}
          min={2}
          max={10}
          step={0.1}
          format={(v) => `${v.toFixed(1)}%`}
          onChange={(fontSize) => setStyle({ fontSize })}
        />
        <Toggle
          label="MAYÚSCULAS"
          checked={style.uppercase}
          onChange={(uppercase) => setStyle({ uppercase })}
        />
      </Section>

      <Section title="Colores">
        <div className="grid grid-cols-3 gap-2">
          <ColorInput
            label="Texto"
            value={style.textColor}
            onChange={(textColor) => setStyle({ textColor })}
          />
          <ColorInput
            label="Resaltado"
            value={style.highlightColor}
            onChange={(highlightColor) => setStyle({ highlightColor })}
          />
          <ColorInput
            label="Contorno"
            value={style.outlineColor}
            onChange={(outlineColor) => setStyle({ outlineColor })}
          />
        </div>
        <Slider
          label="Contorno"
          value={style.outlineWidth}
          min={0}
          max={30}
          step={1}
          format={(v) => `${v}%`}
          onChange={(outlineWidth) => setStyle({ outlineWidth })}
        />
        <Slider
          label="Sombra"
          value={style.shadowBlur}
          min={0}
          max={30}
          step={1}
          format={(v) => `${v}%`}
          onChange={(shadowBlur) =>
            setStyle({ shadowBlur, shadowOffsetY: Math.round(shadowBlur / 2.5) })
          }
        />
        <Segmented
          label="Fondo"
          value={style.background}
          onChange={(background) => setStyle({ background })}
          options={[
            { value: 'none', label: 'Sin fondo' },
            { value: 'box', label: 'Caja' },
            { value: 'word', label: 'Palabra' },
          ]}
        />
        {style.background !== 'none' && (
          <ColorInput
            label="Color del fondo"
            value={style.backgroundColor}
            withAlpha
            onChange={(backgroundColor) => setStyle({ backgroundColor })}
          />
        )}
      </Section>

      <Section title="Posición">
        <Segmented
          label="Posición"
          value={style.position}
          onChange={(position) => setStyle({ position })}
          options={[
            { value: 'top', label: 'Arriba' },
            { value: 'middle', label: 'Centro' },
            { value: 'bottom', label: 'Abajo' },
          ]}
        />
        <Slider
          label="Ajuste vertical"
          value={style.offsetY}
          min={-30}
          max={30}
          step={0.5}
          format={(v) => `${v > 0 ? '+' : ''}${v}%`}
          onChange={(offsetY) => setStyle({ offsetY })}
        />
        <Toggle
          label="Mostrar zonas seguras (TikTok, Reels, Shorts)"
          checked={showSafeZones}
          onChange={(value) => useEditor.setState({ showSafeZones: value })}
        />
      </Section>

      <Section title="Animación">
        <Segmented
          label="Resaltar"
          value={style.highlight}
          onChange={(highlight) => setStyle({ highlight })}
          options={[
            { value: 'none', label: 'Nada' },
            { value: 'color', label: 'Palabra' },
            { value: 'karaoke', label: 'Karaoke' },
          ]}
        />
        <Segmented
          label="Aparición"
          value={style.reveal}
          onChange={(reveal) => setStyle({ reveal })}
          options={[
            { value: 'caption', label: 'Todo junto' },
            { value: 'word', label: 'Palabra por palabra' },
          ]}
        />
        <Segmented
          label="Efecto"
          value={style.animation}
          onChange={(animation) => setStyle({ animation })}
          options={[
            { value: 'none', label: 'Ninguno' },
            { value: 'pop', label: 'Pop' },
            { value: 'fade', label: 'Fundido' },
            { value: 'slide', label: 'Subir' },
          ]}
        />
        <Toggle
          label={
            <span className="inline-flex items-center gap-1">
              <Smile className="size-3.5" aria-hidden /> Emojis automáticos (dinero → 💰)
            </span>
          }
          checked={style.emojis}
          onChange={(emojis) => setStyle({ emojis })}
        />
      </Section>

      <Section title="Líneas">
        <Slider
          label="Caracteres por línea"
          value={rules.maxCharsPerLine}
          min={10}
          max={60}
          step={1}
          format={(v) => String(v)}
          onChange={(maxCharsPerLine) => setRules({ maxCharsPerLine })}
        />
        <Segmented
          label="Líneas"
          value={String(rules.maxLines)}
          onChange={(v) => setRules({ maxLines: Number(v) })}
          options={[
            { value: '1', label: '1 línea' },
            { value: '2', label: '2 líneas' },
          ]}
        />
        <Segmented
          label="Palabras por subtítulo"
          value={String(rules.maxWordsPerCaption ?? 'auto')}
          onChange={(v) => setRules({ maxWordsPerCaption: v === 'auto' ? null : Number(v) })}
          options={[
            { value: 'auto', label: 'Auto' },
            { value: '1', label: '1' },
            { value: '2', label: '2' },
            { value: '3', label: '3' },
            { value: '5', label: '5' },
          ]}
        />
      </Section>
    </div>
  );
}

function PresetSwatch({ style, label }: { style: CaptionStyle; label: string }) {
  const text = style.uppercase ? label.toUpperCase() : label;
  return (
    <span
      className="block truncate rounded-md bg-black/70 px-2 py-1.5 text-center text-base"
      style={{
        fontFamily: `"${style.fontFamily}", sans-serif`,
        fontWeight: style.fontWeight,
        color: style.highlight === 'none' ? style.textColor : style.highlightColor,
        WebkitTextStroke: style.outlineWidth > 0 ? `1px ${style.outlineColor}` : undefined,
        background: style.background === 'box' ? style.backgroundColor : undefined,
      }}
    >
      {text}
    </span>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</h3>
      {children}
    </section>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="flex justify-between">
        <span>{label}</span>
        <span className="font-mono text-xs text-muted">{format(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-brand"
      />
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-brand"
      />
    </label>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-lg border border-line bg-surface-2 px-2"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="space-y-1 text-sm">
      <legend className="mb-1">{label}</legend>
      <div className="flex flex-wrap gap-1 rounded-lg bg-surface-2 p-1">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
            className={`flex-1 rounded-md px-2 py-1 text-xs transition ${
              o.value === value ? 'bg-surface text-fg shadow' : 'text-muted hover:text-fg'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function ColorInput({
  label,
  value,
  withAlpha,
  onChange,
}: {
  label: string;
  value: string;
  withAlpha?: boolean;
  onChange: (v: string) => void;
}) {
  const { r, g, b, a } = parseColor(value);
  const hex = `#${[r, g, b].map((n) => Math.round(n).toString(16).padStart(2, '0')).join('')}`;
  const emit = (nextHex: string, alpha: number) => {
    if (!withAlpha) {
      onChange(nextHex);
      return;
    }
    const n = parseColor(nextHex);
    onChange(`rgba(${n.r},${n.g},${n.b},${alpha.toFixed(2)})`);
  };
  return (
    <label className="block space-y-1 text-xs">
      <span>{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="color"
          value={hex}
          onChange={(e) => emit(e.target.value, a)}
          className="h-8 w-full min-w-10 cursor-pointer rounded border border-line bg-transparent"
        />
        {withAlpha && (
          <input
            type="range"
            aria-label={`Opacidad de ${label.toLowerCase()}`}
            min={0}
            max={1}
            step={0.05}
            value={a}
            onChange={(e) => emit(hex, Number(e.target.value))}
            className="w-24 accent-brand"
          />
        )}
      </span>
    </label>
  );
}
