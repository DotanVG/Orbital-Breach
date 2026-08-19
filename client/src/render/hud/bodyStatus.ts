import type { DamageState } from "../../../../shared/schema";

type BodyStatusTone = "clear" | "partial" | "critical";

interface BodyStatusPart {
  id: "head" | "leftArm" | "core" | "rightArm" | "leftLeg" | "rightLeg";
  label: string;
  tone: BodyStatusTone;
}

interface BodyStatusSummary {
  title: string;
  detail: string;
  mobility: string;
}

const BODY_PART_LABELS: Array<Pick<BodyStatusPart, "id" | "label">> = [
  { id: "head", label: "Head" },
  { id: "leftArm", label: "L Arm" },
  { id: "core", label: "Core" },
  { id: "rightArm", label: "R Arm" },
  { id: "leftLeg", label: "L Leg" },
  { id: "rightLeg", label: "R Leg" },
];

export function damageStateSignature(damage: DamageState): string {
  return [
    damage.frozen ? "1" : "0",
    damage.leftArm ? "1" : "0",
    damage.rightArm ? "1" : "0",
    damage.leftLeg ? "1" : "0",
    damage.rightLeg ? "1" : "0",
  ].join("");
}

export function getBodyStatusParts(damage: DamageState): BodyStatusPart[] {
  return BODY_PART_LABELS.map((part) => ({
    ...part,
    tone: resolvePartTone(part.id, damage),
  }));
}

export function getBodyStatusSummary(damage: DamageState): BodyStatusSummary {
  if (damage.frozen) {
    return {
      title: "Pilot Frozen",
      detail: "Core systems locked",
      mobility: "Launch offline",
    };
  }

  const disabledCount = [damage.leftArm, damage.rightArm, damage.leftLeg, damage.rightLeg]
    .filter(Boolean)
    .length;

  if (disabledCount === 0) {
    return {
      title: "Systems Nominal",
      detail: "No freeze damage",
      mobility: "Launch 100%",
    };
  }

  return {
    title: "Partial Freeze",
    detail: `${disabledCount} limb${disabledCount === 1 ? "" : "s"} impaired`,
    mobility: getMobilityLabel(damage),
  };
}

export function buildBodyStatusHtml(damage: DamageState): string {
  const summary = getBodyStatusSummary(damage);
  const parts = getBodyStatusParts(damage);

  return `
    <div class="ob-body-status">
      <div class="ob-body-status__header">
        <div class="ob-body-status__eyebrow">Body Status</div>
        <div class="ob-body-status__title">${summary.title}</div>
        <div class="ob-body-status__detail">${summary.detail}</div>
      </div>
      <div class="ob-body-status__diagram">
        ${parts.map((part) => (
          `<div class="ob-body-status__part ob-body-status__part--${part.id} ob-body-status__part--${part.tone}">
            <span>${part.label}</span>
          </div>`
        )).join("")}
      </div>
      <div class="ob-body-status__footer">
        <span class="ob-body-status__metric">${summary.mobility}</span>
        <span class="ob-body-status__legend">
          <span class="ob-body-status__swatch ob-body-status__swatch--clear"></span> Clear
        </span>
        <span class="ob-body-status__legend">
          <span class="ob-body-status__swatch ob-body-status__swatch--partial"></span> Impaired
        </span>
        <span class="ob-body-status__legend">
          <span class="ob-body-status__swatch ob-body-status__swatch--critical"></span> Frozen
        </span>
      </div>
    </div>
  `;
}

function resolvePartTone(partId: BodyStatusPart["id"], damage: DamageState): BodyStatusTone {
  if (damage.frozen) return "critical";

  switch (partId) {
    case "head":
    case "core":
      return "clear";
    case "leftArm":
      return damage.leftArm ? "partial" : "clear";
    case "rightArm":
      return damage.rightArm ? "partial" : "clear";
    case "leftLeg":
      return damage.leftLeg ? "partial" : "clear";
    case "rightLeg":
      return damage.rightLeg ? "partial" : "clear";
  }
}

function getMobilityLabel(damage: DamageState): string {
  if (damage.leftLeg && damage.rightLeg) return "Launch 50%";
  if (damage.leftLeg || damage.rightLeg) return "Launch 75%";
  return "Launch 100%";
}
