export type Medication = {
  name: string;
  schedule: number; // Hour in 24-hour format (0-23)
  recurrence: "daily" | "weekly";
  active: boolean;
  createdAt: number;
  nextDoseTime: number;
  doses: Dose[];
};

export type Dose = {
  nextDoseTime: number;
  takentimestamp: number;
  lastTaken?: number;
};

export type CreateMedicationRequest = {
  name: string;
  schedule: number; // Hour in 24-hour format (0-23)
  recurrence: "daily" | "weekly";
};
