export type Medication = {
  medicationId: string;
  name: string;
  schedule: string;
  recurrence: "daily" | "weekly";
  active: boolean;
  createdAt: number;
  doses: Dose[];
};

export type Dose = {
  doseId: string;
  takentimestamp: number;
  lastTaken?: number;
};

export type CreateMedicationRequest = {
  name: string;
  schedule: string;
  recurrence: "daily" | "weekly";
};
