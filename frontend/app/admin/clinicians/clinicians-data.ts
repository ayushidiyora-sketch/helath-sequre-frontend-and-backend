/**
 * Mock clinician roster — shared by the clinicians list page and the
 * clinician detail page. Frontend-only demo data; no backend.
 */

export type ClinicianStatus = "active" | "onboarding" | "deactivated";

export interface ClinicianRecord {
  id: string; // route slug
  name: string;
  initials: string;
  status: ClinicianStatus;
  // Professional
  specialty: string;
  subSpecialization?: string;
  licenseNo: string;
  registrationCouncil: string;
  qualifications: string;
  yearsOfExperience: number;
  // Department & assignment
  department: string;
  designation: string;
  employmentType: string;
  consultationFee: string;
  // Schedule
  workingDays: string[];
  workingHours: string;
  slotDuration: string;
  breakTime?: string;
  maxPatientsPerDay?: number;
  // Panel
  panelSize: number;
  acceptingNewPatients: boolean;
  appointmentTypes: string[];
  utilization: number;
  // Profile
  email: string;
  phone: string;
  joiningDate: string;
  languages: string[];
  bio: string;
  awards?: string;
}

export const CLINICIANS: ClinicianRecord[] = [
  {
    id: "priya-shah",
    name: "Dr. Priya Shah",
    initials: "PS",
    status: "active",
    specialty: "Cardiology",
    subSpecialization: "Interventional Cardiology",
    licenseNo: "GMC-2014-58213",
    registrationCouncil: "Gujarat Medical Council",
    qualifications: "MBBS, MD, DM",
    yearsOfExperience: 14,
    department: "Cardiology",
    designation: "Senior Consultant",
    employmentType: "Full-time",
    consultationFee: "₹1,200",
    workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    workingHours: "9 AM – 12 PM, 2 PM – 5:30 PM",
    slotDuration: "15 min",
    breakTime: "12:00 – 14:00",
    maxPatientsPerDay: 24,
    panelSize: 87,
    acceptingNewPatients: true,
    appointmentTypes: ["In-person", "Follow-up", "Emergency"],
    utilization: 92,
    email: "priya.shah@citygeneral.health",
    phone: "+91 98250 41001",
    joiningDate: "Feb 12, 2018",
    languages: ["English", "Hindi", "Gujarati"],
    bio: "Interventional cardiologist with 14 years of experience in coronary intervention and structural heart disease. Member of the Cardiological Society of India.",
    awards: "Best Faculty Award 2022 · Published 18 peer-reviewed papers",
  },
  {
    id: "rohan-iyer",
    name: "Dr. Rohan Iyer",
    initials: "RI",
    status: "active",
    specialty: "General Medicine",
    licenseNo: "MMC-2012-44182",
    registrationCouncil: "Maharashtra Medical Council",
    qualifications: "MBBS, MD",
    yearsOfExperience: 16,
    department: "General Medicine",
    designation: "Lead Physician",
    employmentType: "Full-time",
    consultationFee: "₹900",
    workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    workingHours: "8:30 AM – 1 PM, 3 PM – 6 PM",
    slotDuration: "20 min",
    breakTime: "13:00 – 15:00",
    maxPatientsPerDay: 32,
    panelSize: 142,
    acceptingNewPatients: true,
    appointmentTypes: ["In-person", "Follow-up"],
    utilization: 78,
    email: "rohan.iyer@citygeneral.health",
    phone: "+91 99202 78340",
    joiningDate: "Aug 4, 2016",
    languages: ["English", "Hindi", "Marathi"],
    bio: "General physician focused on chronic-disease management, preventive care, and on-call inpatient coverage.",
    awards: "Faculty mentor of the year 2021",
  },
  {
    id: "neha-kapoor",
    name: "Dr. Neha Kapoor",
    initials: "NK",
    status: "active",
    specialty: "Dermatology",
    subSpecialization: "Cosmetic dermatology",
    licenseNo: "DMC-2017-67009",
    registrationCouncil: "Delhi Medical Council",
    qualifications: "MBBS, MD (Dermatology)",
    yearsOfExperience: 9,
    department: "Dermatology",
    designation: "Consultant",
    employmentType: "Full-time",
    consultationFee: "₹1,000",
    workingDays: ["Mon", "Wed", "Thu", "Fri"],
    workingHours: "10 AM – 1 PM, 2:30 PM – 5 PM",
    slotDuration: "20 min",
    breakTime: "13:00 – 14:30",
    maxPatientsPerDay: 18,
    panelSize: 64,
    acceptingNewPatients: true,
    appointmentTypes: ["In-person", "Follow-up"],
    utilization: 65,
    email: "neha.kapoor@citygeneral.health",
    phone: "+91 98711 22013",
    joiningDate: "Jan 21, 2020",
    languages: ["English", "Hindi"],
    bio: "Dermatologist with a focus on clinical and cosmetic dermatology, allergy management, and dermato-pathology.",
  },
  {
    id: "aisha-khan",
    name: "Dr. Aisha Khan",
    initials: "AK",
    status: "onboarding",
    specialty: "Pediatrics",
    licenseNo: "KMC-2019-30982",
    registrationCouncil: "Karnataka Medical Council",
    qualifications: "MBBS, DCH, MD (Pediatrics)",
    yearsOfExperience: 7,
    department: "Pediatrics",
    designation: "Consultant",
    employmentType: "Full-time",
    consultationFee: "₹800",
    workingDays: [],
    workingHours: "Pending invitation acceptance",
    slotDuration: "20 min",
    panelSize: 0,
    acceptingNewPatients: false,
    appointmentTypes: ["In-person"],
    utilization: 0,
    email: "aisha.khan@citygeneral.health",
    phone: "+91 98456 99221",
    joiningDate: "Invitation sent May 19, 2026",
    languages: ["English", "Hindi", "Urdu", "Kannada"],
    bio: "Pediatrician specializing in neonatal and developmental care. Onboarding in progress.",
  },
];

export function getClinician(id: string): ClinicianRecord | undefined {
  return CLINICIANS.find((c) => c.id === id);
}
