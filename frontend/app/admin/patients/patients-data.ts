/**
 * Mock patient roster — shared by the list page and the detail page.
 * Frontend-only demo data; no backend.
 */

export interface PatientRecord {
  id: string; // route slug
  mrn: string;
  patientId: string;
  name: string;
  firstName: string;
  lastName: string;
  initials: string;
  status: "active" | "deactivated";
  since: string;
  // Personal
  email: string;
  phone: string;
  dob: string;
  gender: string;
  bloodGroup: string;
  // Contact & address
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  // Identity
  aadhaarMasked: string;
  abhaId: string;
  // Emergency contact
  emergencyName: string;
  emergencyRelation: string;
  emergencyPhone: string;
  // Insurance
  insuranceProvider: string;
  insurancePolicyMasked: string;
  // Assignment
  clinician: string;
  department: string;
  patientType: string;
  referralSource: string;
  // Registration meta
  registeredBy: string;
  registrationMethod: string;
  registeredOn: string;
  // Visit info
  visitReason: string;
  preferredLanguage: string;
  preferredContact: string;
}

export const PATIENTS: PatientRecord[] = [
  {
    id: "aarav-mehta",
    mrn: "CG-2026-0481",
    patientId: "PT-9f3a21c8",
    name: "Aarav Mehta",
    firstName: "Aarav",
    lastName: "Mehta",
    initials: "AM",
    status: "active",
    since: "Feb 2026",
    email: "aarav.mehta@example.com",
    phone: "+91 98250 41882",
    dob: "1991-04-17",
    gender: "Male",
    bloodGroup: "O+",
    address: "12 Riverside Avenue, Bodakdev",
    city: "Ahmedabad",
    state: "Gujarat",
    postalCode: "380015",
    country: "India",
    aadhaarMasked: "XXXX XXXX 9012",
    abhaId: "12-3456-7890-1234",
    emergencyName: "Diya Mehta",
    emergencyRelation: "Spouse",
    emergencyPhone: "+91 98250 41883",
    insuranceProvider: "Star Health",
    insurancePolicyMasked: "XXXXXX4471",
    clinician: "Dr. Priya Shah",
    department: "Cardiology",
    patientType: "New",
    referralSource: "Dr. Sharma's clinic",
    registeredBy: "Maya Iyer · Org Admin",
    registrationMethod: "Admin portal",
    registeredOn: "Feb 8, 2026",
    visitReason: "Routine cardiac evaluation after family history of hypertension.",
    preferredLanguage: "English",
    preferredContact: "Phone call",
  },
  {
    id: "neha-bansal",
    mrn: "CG-2026-0492",
    patientId: "PT-7b2d54e1",
    name: "Neha Bansal",
    firstName: "Neha",
    lastName: "Bansal",
    initials: "NB",
    status: "active",
    since: "Mar 2026",
    email: "neha.bansal@example.com",
    phone: "+91 99740 22118",
    dob: "1988-11-02",
    gender: "Female",
    bloodGroup: "A+",
    address: "44 Lake View Road, Satellite",
    city: "Ahmedabad",
    state: "Gujarat",
    postalCode: "380059",
    country: "India",
    aadhaarMasked: "XXXX XXXX 3318",
    abhaId: "98-7654-3210-9876",
    emergencyName: "Arjun Bansal",
    emergencyRelation: "Spouse",
    emergencyPhone: "+91 99740 22119",
    insuranceProvider: "HDFC Ergo",
    insurancePolicyMasked: "XXXXXX8820",
    clinician: "Dr. Priya Shah",
    department: "Cardiology",
    patientType: "Returning",
    referralSource: "Self",
    registeredBy: "Maya Iyer · Org Admin",
    registrationMethod: "Admin portal",
    registeredOn: "Mar 3, 2026",
    visitReason: "Follow-up for ongoing blood-pressure management.",
    preferredLanguage: "Hindi",
    preferredContact: "SMS",
  },
  {
    id: "vikram-rao",
    mrn: "CG-2026-0501",
    patientId: "PT-1c8e90a4",
    name: "Vikram Rao",
    firstName: "Vikram",
    lastName: "Rao",
    initials: "VR",
    status: "active",
    since: "Apr 2026",
    email: "vikram.rao@example.com",
    phone: "+91 90999 71140",
    dob: "1979-06-25",
    gender: "Male",
    bloodGroup: "B+",
    address: "8 Hillcrest Society, Vastrapur",
    city: "Ahmedabad",
    state: "Gujarat",
    postalCode: "380052",
    country: "India",
    aadhaarMasked: "XXXX XXXX 7765",
    abhaId: "45-1209-8876-5512",
    emergencyName: "Lata Rao",
    emergencyRelation: "Spouse",
    emergencyPhone: "+91 90999 71141",
    insuranceProvider: "ICICI Lombard",
    insurancePolicyMasked: "XXXXXX1093",
    clinician: "Dr. Rohan Iyer",
    department: "General Medicine",
    patientType: "Referral",
    referralSource: "Apollo Diagnostics",
    registeredBy: "Maya Iyer · Org Admin",
    registrationMethod: "Admin portal",
    registeredOn: "Apr 11, 2026",
    visitReason: "General physical and diabetes screening.",
    preferredLanguage: "English",
    preferredContact: "Email",
  },
  {
    id: "saanvi-sen",
    mrn: "CG-2026-0476",
    patientId: "PT-5a6f33b2",
    name: "Saanvi Sen",
    firstName: "Saanvi",
    lastName: "Sen",
    initials: "SS",
    status: "active",
    since: "Feb 2026",
    email: "saanvi.sen@example.com",
    phone: "+91 98198 55027",
    dob: "1996-09-14",
    gender: "Female",
    bloodGroup: "AB+",
    address: "21 Garden Enclave, Thaltej",
    city: "Ahmedabad",
    state: "Gujarat",
    postalCode: "380054",
    country: "India",
    aadhaarMasked: "XXXX XXXX 2240",
    abhaId: "33-7781-2204-6650",
    emergencyName: "Rahul Sen",
    emergencyRelation: "Sibling",
    emergencyPhone: "+91 98198 55028",
    insuranceProvider: "Niva Bupa",
    insurancePolicyMasked: "XXXXXX6634",
    clinician: "Dr. Neha Kapoor",
    department: "Dermatology",
    patientType: "New",
    referralSource: "Walk-in",
    registeredBy: "Maya Iyer · Org Admin",
    registrationMethod: "Admin portal",
    registeredOn: "Feb 19, 2026",
    visitReason: "Persistent skin allergy assessment.",
    preferredLanguage: "English",
    preferredContact: "WhatsApp",
  },
  {
    id: "rohan-jain",
    mrn: "CG-2026-0455",
    patientId: "PT-2e4b77d9",
    name: "Rohan Jain",
    firstName: "Rohan",
    lastName: "Jain",
    initials: "RJ",
    status: "active",
    since: "Jan 2026",
    email: "rohan.jain@example.com",
    phone: "+91 97250 30094",
    dob: "1984-02-08",
    gender: "Male",
    bloodGroup: "O-",
    address: "5 Sunrise Apartments, Navrangpura",
    city: "Ahmedabad",
    state: "Gujarat",
    postalCode: "380009",
    country: "India",
    aadhaarMasked: "XXXX XXXX 5571",
    abhaId: "61-3390-4417-2208",
    emergencyName: "Priya Jain",
    emergencyRelation: "Spouse",
    emergencyPhone: "+91 97250 30095",
    insuranceProvider: "Tata AIG",
    insurancePolicyMasked: "XXXXXX2287",
    clinician: "Dr. Rohan Iyer",
    department: "General Medicine",
    patientType: "Returning",
    referralSource: "Self",
    registeredBy: "Maya Iyer · Org Admin",
    registrationMethod: "Admin portal",
    registeredOn: "Jan 22, 2026",
    visitReason: "Annual health check-up.",
    preferredLanguage: "Gujarati",
    preferredContact: "Phone call",
  },
  {
    id: "riya-mehta",
    mrn: "CG-2026-0488",
    patientId: "PT-8d1c62f5",
    name: "Riya Mehta",
    firstName: "Riya",
    lastName: "Mehta",
    initials: "RM",
    status: "deactivated",
    since: "Feb 2026",
    email: "riya.mehta@example.com",
    phone: "+91 99090 14478",
    dob: "1999-12-30",
    gender: "Female",
    bloodGroup: "A-",
    address: "17 Maple Court, Prahlad Nagar",
    city: "Ahmedabad",
    state: "Gujarat",
    postalCode: "380015",
    country: "India",
    aadhaarMasked: "XXXX XXXX 8809",
    abhaId: "27-6612-9930-4471",
    emergencyName: "Kabir Mehta",
    emergencyRelation: "Parent",
    emergencyPhone: "+91 99090 14479",
    insuranceProvider: "—",
    insurancePolicyMasked: "—",
    clinician: "Dr. Priya Shah",
    department: "Cardiology",
    patientType: "New",
    referralSource: "Self",
    registeredBy: "Maya Iyer · Org Admin",
    registrationMethod: "Admin portal",
    registeredOn: "Feb 5, 2026",
    visitReason: "Initial consultation — account since deactivated on request.",
    preferredLanguage: "English",
    preferredContact: "Email",
  },
];

export function getPatient(id: string): PatientRecord | undefined {
  return PATIENTS.find((p) => p.id === id);
}
