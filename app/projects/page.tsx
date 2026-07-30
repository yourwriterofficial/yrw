'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import * as lucide from 'lucide-react';
import {
  BookOpen, Clock, Loader2, Lock, Search, ShieldCheck,
  Puzzle, Share2, Eye, CheckCircle2, Users, X, FileText,
  Calendar, ScrollText, Zap, AlertTriangle, CreditCard,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import ProjectsAssistant from '@/app/components/ProjectsAssistant';
import Header from '@/app/components/Header';
import Button from '@/app/components/ui/Button';
import Card from '@/app/components/ui/Card';
import { Badge } from '@/app/components/ui/Badge';
import { Input } from '@/app/components/ui/Input';
import { Checkbox } from '@/app/components/ui/Checkbox';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { Shell } from '@/app/components/ui/Shell';
import { Select } from '@/app/components/ui/Select';
import { Textarea } from '@/app/components/ui/Textarea';

type Topic = {
  id: number;
  title: string;
  department: string;
  description: string | null;
  pages: number | null;
  chapters: string | null;
  format: string | null;
  year: number | null;
  level: string;
  price: number;
};

type Addon = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  price_type?: string;
  features?: { name: string; price: number }[];
  is_location_changer?: boolean;
};

type Cart = {
  topicId?: number;
  customTitle?: string;
  department?: string;
  level: string;
  title: string;
  basePrice: number;
};

const naira = (n: number) => '₦' + Math.round(n || 0).toLocaleString('en-NG');
const PAGE_SIZE = 30;

const NIGERIAN_DEPARTMENTS = [
  "Accountancy / Accounting",
  "Actuarial Science",
  "Adult Education",
  "Agricultural Economics",
  "Agricultural Engineering",
  "Agricultural Science",
  "Anatomy",
  "Animal Science",
  "Applied Biochemistry",
  "Applied Chemistry",
  "Architecture",
  "Banking and Finance",
  "Biochemistry",
  "Biological Sciences",
  "Botany",
  "Business Administration",
  "Chemical Engineering",
  "Chemistry",
  "Civil Engineering",
  "Civil Law",
  "Common Law",
  "Computer Engineering",
  "Computer Science",
  "Cooperative and Rural Development",
  "Creative Arts",
  "Dentistry",
  "Economics",
  "Educational Management",
  "Electrical / Electronic Engineering",
  "English Language",
  "English and Literary Studies",
  "Estate Management",
  "Fine and Applied Arts",
  "Fisheries and Aquaculture",
  "Food Science and Technology",
  "Forestry and Wildlife Management",
  "Geography",
  "Geology",
  "Guidance and Counseling",
  "History and International Studies",
  "Industrial Chemistry",
  "Industrial Relations and Personnel Management",
  "Insurance",
  "International Relations",
  "Library and Information Science",
  "Linguistics",
  "Mass Communication",
  "Mathematics",
  "Mechanical Engineering",
  "Mechatronics Engineering",
  "Medical Laboratory Science",
  "Medicine and Surgery",
  "Microbiology",
  "Music",
  "Nursing Science",
  "Optometry",
  "Petroleum Engineering",
  "Pharmacy",
  "Philosophy",
  "Physics",
  "Physiology",
  "Political Science",
  "Public Administration",
  "Public Health",
  "Quantity Surveying",
  "Radiography",
  "Religious Studies",
  "Sociology",
  "Statistics",
  "Surveying and Geoinformatics",
  "Theatre Arts",
  "Urban and Regional Planning",
  "Veterinary Medicine",
  "Zoology"
];

// ---- Tribe-grouped writer name pools (700+ names, 15+ Nigerian tribes) ----

// IGBO (~50 first, ~40 last)
const IGBO_FIRST = [
  "Chidi", "Emeka", "Kelechi", "Uchenna", "Tochukwu", "Nonso", "Ejike", "Nnamdi", "Ngozi", "Chioma",
  "Chinyere", "Ifeoma", "Ogechi", "Uju", "Ezinne", "Nneka", "Chinedu", "Chika", "Ezenwa", "Obinna",
  "Somto", "Uche", "Ikechukwu", "Goziem", "Adaeze", "Onyekachi", "Chiamaka", "Ogochukwu", "Obiageli",
  "Chinonso", "Chibuike", "Ugochi", "Adannaya", "Amarachi", "Uchechukwu", "Nkiruka", "Chinaza", "Ebube",
  "Odinaka", "Chidinma", "Onyeka", "Ifunanya", "Chibundo", "Tobenna", "Kenechukwu", "Chimamanda",
  "Ginika", "Ugochukwu", "Obioma", "Chukwuemeka", "Onyedikachi", "Chigozie", "Akachukwu",
  "Nwanneka", "Ezechukwu", "Amaka", "Chizoba", "Onyinye", "Ugomma", "Adanna",
];
const IGBO_LAST = [
  "Okeke", "Okafor", "Nwosu", "Okoye", "Nwachukwu", "Opara", "Diala", "Ezeugo", "Onuoha", "Eze",
  "Obi", "Okoro", "Chukwu", "Igwe", "Kalu", "Onyema", "Uba", "Nwankwo", "Obiora", "Aniagu",
  "Ugwu", "Nwofor", "Onyekwere", "Ezeaku", "Nwogu", "Ogbuagu", "Nweze", "Umeh", "Agu", "Ogbu",
  "Nwafor", "Onyemenam", "Ezeilo", "Onwudiwe", "Nzekwe", "Okonkwo", "Ihejirika", "Obasi", "Okpara",
  "Nnaji", "Ojukwu", "Onyia", "Eze-Onwu", "Mbah", "Nwagbo", "Ezeh", "Asadu", "Anigbo",
];

// YORUBA (~50 first, ~40 last)
const YORUBA_FIRST = [
  "Olumide", "Babajide", "Tunde", "Segun", "Adebayo", "Femi", "Kunle", "Jide", "Kola", "Dayo",
  "Wale", "Damilola", "Temitope", "Gbolahan", "Yetunde", "Funmilayo", "Tolani", "Kemi", "Shade",
  "Adesua", "Bisola", "Eniola", "Folake", "Ronke", "Tolu", "Yemisi", "Seyi", "Bisi",
  "Dapo", "Gbenga", "Leke", "Muyiwa", "Tobi", "Yinka", "Biyi", "Tokunbo", "Mide", "Wole",
  "Oluwaseun", "Adedayo", "Temitayo", "Oluwafemi", "Adeola", "Taiwo", "Kehinde", "Opeyemi",
  "Oluwatobi", "Ayobami", "Oluwakemi", "Oluwaseyi", "Adeleke", "Adewale", "Olubunmi", "Ifeoluwa",
  "Ayooluwa", "Omowunmi", "Adefunke", "Aderopo", "Bukola", "Motunrayo",
];
const YORUBA_LAST = [
  "Balogun", "Adebayo", "Ojo", "Alabi", "Babalola", "Awolowo", "Soyinka", "Adenuga", "Alakija",
  "Adeleke", "Abiola", "Falz", "Bankole", "Akinyemi", "Coker", "Oluwole", "Adeyemi", "Alonge",
  "Olatunji", "Daramola", "Oyinlola", "Akenzua", "Fagbemi", "Ajayi", "Osinbajo", "Ogundipe",
  "Adeboye", "Olanrewaju", "Oduya", "Babatunde", "Afolabi", "Gbadebo", "Fasanya", "Ayoola",
  "Olopade", "Animashaun", "Lawal", "Makinde", "Adesanya", "Adegboye", "Obafemi", "Osuntokun",
  "Ikuforiji", "Okulaja", "Adeyinka", "Olaleye",
];

// HAUSA-FULANI (~40 first, ~30 last)
const HAUSA_FIRST = [
  "Abdul", "Aminu", "Ibrahim", "Musa", "Yusuf", "Usman", "Amina", "Zainab", "Halima", "Fatimah",
  "Aisha", "Lawal", "Aliyu", "Sani", "Bello", "Maryam", "Hafsat", "Ruqayyah", "Bilkisu", "Hauwa",
  "Abdullahi", "Ismail", "Nuhu", "Yakubu", "Idris", "Rabiu", "Habib", "Nasiru", "Zubairu",
  "Ramatu", "Khadijah", "Fadimatu", "Suwaiba", "Asabe", "Jummai", "Hadiza", "Mairo", "Saratu",
  "Bashir", "Haruna", "Tijjani", "Suleiman",
];
const HAUSA_LAST = [
  "Bello", "Ibrahim", "Abubakar", "Garba", "Usman", "Mohammed", "Dangote", "Danjuma", "Shagari",
  "Sanusi", "Lamido", "Buhari", "Gowon", "Dikko", "Kwankwaso", "Aliyu", "Sule",
  "Abdullahi", "Musa", "Inuwa", "Gambo", "Wada", "Bashir", "Tukur", "Tanko", "Hassan", "Adamu",
  "Maikasuwa", "Tsangaya", "Ringim",
];

// FULANI (~25 first, ~20 last) — distinct from Hausa naming patterns
const FULANI_FIRST = [
  "Modibo", "Hammadu", "Siradio", "Oumarou", "Adama", "Amadou", "Boubacar", "Hawa", "Mariama",
  "Fatoumata", "Balkissa", "Nenneh", "Ramata", "Binta", "Djamila", "Ardo", "Musa", "Umaru",
  "Hamidu", "Yelwa", "Jibril", "Ahmadu", "Aliou", "Kadija", "Hadijatou",
];
const FULANI_LAST = [
  "Barry", "Balde", "Diallo", "Jallo", "Sow", "Ba", "Bah", "Tall", "Toure", "Camara",
  "Bello", "Yero", "Sule", "Mamman", "Sambo", "Mairiga", "Danfodio", "Labbo",
];

// IJaw / IZON (~30 first, ~25 last)
const IJAW_FIRST = [
  "Peremo", "Ebiowei", "Doubara", "Suoton", "Tamaraebi", "Ebiakpo", "Diepreye", "Opuofoni",
  "Ayibakuro", "Bibowei", "Timi", "Angala", "Erefawei", "Preye", "Taribo", "Adaka", "Boma",
  "Ebiere", "Doris", "Oyinkuro", "Eruotor", "Tamaraufa", "Kemesowei", "Ibifuro", "Tamuno",
  "Opibi", "Bioye", "Ebiowei", "Oruene", "Youfa",
];
const IJAW_LAST = [
  "Okoko", "Amapu", "Owei", "Okoya", "Tombia", "Kpakiama", "Tebepah", "Egbe", "Inengite",
  "Gbonewei", "Dokubo", "Oki", "Ebiri", "Amabebe", "Ayawei", "Akpoebi", "Tonye",
  "Binitie", "Ebizimor", "Dimieari", "Poloamina", "Preye", "Arubai", "Seibarugu",
];

// EFIK (~25 first, ~20 last)
const EFIK_FIRST = [
  "Eyo", "Asuquo", "Okon", "Bassey", "Etim", "Ndifreke", "Iquo", "Akon", "Uduak", "Atim",
  "Edidiong", "Uwem", "Ekemini", "Emem", "Ekpe", "Affiong", "Aniema", "Ubong", "Obong", "Ini",
  "Mfon", "Itoro", "Nkereuwem", "Ima", "Nsikak",
];
const EFIK_LAST = [
  "Ekanem", "Ekpo", "Essien", "Bassey", "Okon", "Inyang", "Etim", "Asuquo", "Akpan", "Udofia",
  "Edem", "Nsa", "Effiong", "Ekong", "Usoro", "Utuk", "Eno", "Ukpong", "Ntuk",
];

// IBIBIO (~25 first, ~20 last) — closely related to Efik but distinct
const IBIBIO_FIRST = [
  "Ekpenyong", "Akaninyene", "Idongesit", "Enoobong", "Nsidibe", "Enobong", "Ekemini", "Ifiok",
  "Ndiana", "Ntiense", "Anietie", "Ofonime", "Ekaete", "Obianuju", "Akpabio", "Andem",
  "Ekom", "Uko", "Ndidi", "Idorenyin", "Uduak", "Esit", "Iniobong", "Nkoyo", "Anyim",
];
const IBIBIO_LAST = [
  "Akpan", "Udoh", "Umoh", "Udo", "Ikpe", "Essen", "Ibok", "Ntukidem", "Obot", "Ebong",
  "Udosen", "Edet", "Antia", "Mbong", "Ikot", "Ekerete", "Efiok", "Udoekong", "Ikpeme",
];

// TIV (~25 first, ~20 last)
const TIV_FIRST = [
  "Aondo", "Terhile", "Iorlamen", "Ubam", "Tyav", "Andesikaa", "Iember", "Doosuur", "Terngu",
  "Terdoo", "Mbakor", "Gbaasen", "Bemsen", "Terfa", "Dzua", "Mfon", "Orji", "Mngehen",
  "Anum", "Gyebi", "Kperan", "Mbaaza", "Uyam", "Mfon", "Bur",
];
const TIV_LAST = [
  "Shagbaor", "Iorlaha", "Gbor", "Waya", "Tyem", "Akume", "Suswam", "Awua", "Tor",
  "Tarka", "Iorbee", "Kukwu", "Ugba", "Anure", "Kure", "Dzeremo", "Fanen", "Mbajiua",
];

// EDO / BINI (~30 first, ~25 last)
const EDO_FIRST = [
  "Osaro", "Omosede", "Eghosa", "Osagie", "Osayande", "Itohan", "Adesuwa", "Ehinome",
  "Osazemen", "Omolade", "Eguagie", "Oghenovo", "Omotayo", "Esosa", "Osemwengie", "Ehigie",
  "Osaretin", "Osasuyi", "Omoyemen", "Aidonojie", "Ikponmwosa", "Edokpolor", "Evbuomwan",
  "Aigbogun", "Enabore", "Ehindero", "Okonkwo", "Iyoha", "Isiolo", "Odigie",
];
const EDO_LAST = [
  "Osagie", "Osunde", "Ero", "Ize-Iyamu", "Aigbe", "Omorogbe", "Ogiugo", "Osabuohien",
  "Edokpolor", "Evbayiro", "Igbinosun", "Ekhator", "Odigie", "Ehigie", "Iyawe",
  "Omorodion", "Omoruyi", "Esedebe", "Oronsaye", "Idemudia", "Osemwekha", "Omorogbe",
  "Osegbon", "Ediae", "Ikponmwosa",
];

// URHOBO (~25 first, ~20 last)
const URHOBO_FIRST = [
  "Erhuvwu", "Ogheneruona", "Ogheneovo", "Oghenekaro", "Oghenechovwe", "Oghenevwede",
  "Orode", "Eruotor", "Ovoke", "Ogheneukaro", "Oghenekevwe", "Emoefe", "Ufuoma",
  "Oghenerukewe", "Enuvoke", "Irikefe", "Orobor", "Eruoma", "Oviri", "Orezi",
  "Oghenemine", "Oghene", "Aderukewe", "Oghogho", "Evwruakewe",
];
const URHOBO_LAST = [
  "Okoro", "Okoye", "Eferakeya", "Owhonda", "Egwuogu", "Ekpeki", "Egboka", "Arho",
  "Omonzuanvbo", "Emami", "Egba", "Aghedo", "Adikru", "Ofure", "Okumagba",
  "Oganaka", "Ekwueme", "Etete", "Abraka", "Ovwasa",
];

// ISOKO (~20 first, ~15 last)
const ISOKO_FIRST = [
  "Oghenerukewe", "Oghenekevwe", "Ovwurie", "Erhovwo", "Oweh", "Ogheneochuko",
  "Emerho", "Iruaro", "Ohwovoriole", "Ofevwe", "Adjene", "Ekwuerhe",
  "Avworhe", "Evuarherhe", "Ogheneruwe", "Orhorhoro", "Okiemute", "Oghenerobor",
  "Oghenevwoke", "Ohwovore",
];
const ISOKO_LAST = [
  "Oghenevwoke", "Emiko", "Arhewoh", "Egbo", "Erho", "Ogheneuke", "Isioro",
  "Oviri", "Eferakeya", "Erhieyovwe", "Ohwofa", "Isiavwe", "Ojameruaye", "Oghenemine",
];

// ITSEKIRI (~20 first, ~15 last)
const ITSEKIRI_FIRST = [
  "Ginuwa", "Emiko", "Olu", "Atsepoyi", "Oritseweyinmi", "Oritsegbemi", "Oritsejolomi",
  "Temitayo", "Sola", "Oritseyemisi", "Arese", "Imoru", "Uvieghara",
  "Oritsematosan", "Oloruntoba", "Obaro", "Ogheneruona", "Oghenemine",
  "Ogheneoro", "Eyitayo",
];
const ITSEKIRI_LAST = [
  "Ologbotsere", "Emiko", "Nana", "Ginuwa", "Olu", "Dore", "Atsepoyi",
  "Uwangue", "Oritsemoyemi", "Kakra", "Oriakhi", "Orugbani", "Ajogun", "Omatsola",
];

// NUPE (~20 first, ~15 last)
const NUPE_FIRST = [
  "Bello", "Etsu", "Salihu", "Ndako", "Yisa", "Edibo", "Gana", "Mama", "Doko",
  "Isah", "Ndacefu", "Tajo", "Musa", "Umoru", "Aliyu", "Jibrin",
  "Halima", "Fatima", "Jummai", "Rakiya",
];
const NUPE_LAST = [
  "Ndako", "Bello", "Gana", "Mama", "Masaba", "Etsu", "Doko", "Gari",
  "Cekpa", "Jibrin", "Aliyu", "Sarki", "Umoru", "Shaba",
];

// KANURI (~20 first, ~15 last)
const KANURI_FIRST = [
  "Mustapha", "Kyari", "Bama", "Bukar", "Yerima", "Shettima", "Gana", "Ali",
  "Zannah", "Alkali", "Kachallah", "Goni", "Abba", "Bulama", "Fatima",
  "Hauwa", "Aisha", "Modu", "Lawan", "Umar",
];
const KANURI_LAST = [
  "Shettima", "Kyari", "Gana", "Bukar", "Zannah", "Modu", "Lawan",
  "Kachallah", "Goni", "Mustapha", "Ali", "Imam", "Bulama", "Alhaji",
];

// IGALA (~20 first, ~15 last)
const IGALA_FIRST = [
  "Icheme", "Omale", "Ameh", "Aje", "Ogiri", "Onu", "Akor", "Ejeh", "Ayegba",
  "Agbo", "Okpe", "Okwoli", "Ameh", "Atu", "Ochai", "Ocho", "Ojabo", "Baba",
  "Eneji", "Oche",
];
const IGALA_LAST = [
  "Ameh", "Ayegba", "Agbo", "Akor", "Ejeh", "Ochai", "Onu", "Baba",
  "Okpe", "Ogiri", "Eneji", "Omale", "Oche", "Atanyi",
];

// EBIRA (~20 first, ~15 last)
const EBIRA_FIRST = [
  "Ozigi", "Obaro", "Ohize", "Okene", "Adoh", "Ogbe", "Okutu", "Ozor",
  "Iyabo", "Abioye", "Akene", "Okorie", "Enehe", "Amina", "Yakubu",
  "Halima", "Ibrahim", "Musa", "Ozigis", "Obaro",
];
const EBIRA_LAST = [
  "Ozigi", "Obaro", "Adoh", "Abubakar", "Okene", "Ohize", "Egbunu",
  "Okutu", "Ogbe", "Omadivi", "Ozoh", "Akana", "Otaru", "Ohiole",
];

// IDOMA (~20 first, ~15 last)
const IDOMA_FIRST = [
  "Okpabi", "Attah", "Ogiri", "Adoyi", "Ache", "Ogenyi", "Odoh", "Onah",
  "Ede", "Ogbe", "Omale", "Agbo", "Otu", "Aker", "Ademu", "Ameh",
  "Akpamu", "Elachi", "Ogiri", "Ajobe",
];
const IDOMA_LAST = [
  "Attah", "Agbo", "Ache", "Adoyi", "Onah", "Ogbe", "Ede", "Omale",
  "Aker", "Ademu", "Akpamu", "Elachi", "Ajobe", "Okwoli",
];

// OGONI (~20 first, ~15 last)
const OGONI_FIRST = [
  "Saro-Wiwa", "Nwibia", "Nwibari", "Barigha", "Nwinyiwei", "Nkpuda",
  "Giadom", "Deeyah", "Kpalap", "Naloo", "Sira", "Nwibani", "Bari",
  "Kagbara", "Luah", "Deekor", "Gbalaboribo", "Kpaa", "Doolo", "Gbara",
];
const OGONI_LAST = [
  "Saro-Wiwa", "Nwibari", "Giadom", "Barigha", "Kpalap", "Nkpuda",
  "Luah", "Deekor", "Kagbara", "Naloo", "Gbara", "Badom", "Nwibia",
];

// IKWERRE (~20 first, ~15 last) — distinct Rivers State group, related to Igbo
const IKWERRE_FIRST = [
  "Owunna", "Nwachukwu", "Okereke", "Eke", "Chibuike", "Wosu", "Chibuzo",
  "Nwokolo", "Uchenna", "Obinna", "Chidinma", "Amadi", "Pepple", "Wike",
  "Nkpolu", "Amaechi", "Orlu", "Nwuji", "Ubani", "Okere",
];
const IKWERRE_LAST = [
  "Amadi", "Wosu", "Pepple", "Wike", "Okereke", "Amaechi", "Nkpolu",
  "Ubani", "Nwokolo", "Orlu", "Okere", "Owunna", "Eke", "Nwuji",
];

// ANNANG (~15 first, ~12 last)
const ANNANG_FIRST = [
  "Eno", "Abasifreke", "Nsikak", "Ndifreke", "Affiong", "Iquo", "Edidiong",
  "Uwem", "Emem", "Ndidi", "Ntiense", "Abasi", "Imaobong", "Uduak", "Nkwa",
];
const ANNANG_LAST = [
  "Antia", "Ibok", "Udoh", "Edet", "Obot", "Esen", "Itiat",
  "Ekong", "Udoekong", "Akpan", "Nkpa", "Ebong",
];

// JUKUN (~15 first, ~12 last)
const JUKUN_FIRST = [
  "Aku", "Daji", "Baba", "Wapan", "Gbamji", "Angyu", "Kpanta", "Girmawa",
  "Tukura", "Agbu", "Mela", "Takur", "Ashuku", "Wase", "Dodo",
];
const JUKUN_LAST = [
  "Aku", "Wapan", "Angyu", "Tukura", "Agbu", "Gbamji", "Mela",
  "Takur", "Daji", "Ashuku", "Wase", "Girmawa",
];

// English / Christian names — may pair with any tribe surname
const ENGLISH_FIRST = [
  "Emmanuel", "Blessing", "Grace", "Victor", "Daniel", "Faith", "Miracle", "Precious", "David", "Samuel",
  "Joseph", "Esther", "Ruth", "Stephen", "Philip", "John", "Mary", "Elizabeth", "Peter", "Paul",
  "James", "Mercy", "Charity", "Hope", "Love", "Solomon", "Ezekiel", "Moses", "Caleb", "Joshua",
  "Deborah", "Rebecca", "Naomi", "Hannah", "Abigail", "Nathaniel", "Timothy", "Michael", "Gabriel",
  "Raphael", "Benedict", "Theresa", "Christina", "Patricia", "Florence", "Cynthia", "Angela",
];

// ALL surnames pool (for English-name cross-pairing)
const ALL_LAST = [
  ...IGBO_LAST, ...YORUBA_LAST, ...HAUSA_LAST, ...FULANI_LAST,
  ...IJAW_LAST, ...EFIK_LAST, ...IBIBIO_LAST, ...TIV_LAST,
  ...EDO_LAST, ...URHOBO_LAST, ...ISOKO_LAST, ...ITSEKIRI_LAST,
  ...NUPE_LAST, ...KANURI_LAST, ...IGALA_LAST, ...EBIRA_LAST,
  ...IDOMA_LAST, ...OGONI_LAST, ...IKWERRE_LAST, ...ANNANG_LAST, ...JUKUN_LAST,
];

// Tribe groups with probability weights (total = 1.0)
// Igbo 22%, Yoruba 22%, Hausa 15%, Fulani 5%, Ijaw 6%,
// Efik 4%, Ibibio 4%, Tiv 4%, Edo 4%, Urhobo 3%,
// Isoko 1%, Itsekiri 1%, Nupe 1%, Kanuri 1%, Igala 1%,
// Ebira 1%, Idoma 1%, Ogoni 1%, Ikwerre 1%, Annang 0.5%, Jukun 0.5%, English 1%
const TRIBE_POOL: Array<{ first: string[]; last: string[]; weight: number }> = [
  { first: IGBO_FIRST,     last: IGBO_LAST,     weight: 0.22 },
  { first: YORUBA_FIRST,   last: YORUBA_LAST,   weight: 0.22 },
  { first: HAUSA_FIRST,    last: HAUSA_LAST,    weight: 0.15 },
  { first: FULANI_FIRST,   last: FULANI_LAST,   weight: 0.05 },
  { first: IJAW_FIRST,     last: IJAW_LAST,     weight: 0.06 },
  { first: EFIK_FIRST,     last: EFIK_LAST,     weight: 0.04 },
  { first: IBIBIO_FIRST,   last: IBIBIO_LAST,   weight: 0.04 },
  { first: TIV_FIRST,      last: TIV_LAST,      weight: 0.04 },
  { first: EDO_FIRST,      last: EDO_LAST,      weight: 0.04 },
  { first: URHOBO_FIRST,   last: URHOBO_LAST,   weight: 0.03 },
  { first: ISOKO_FIRST,    last: ISOKO_LAST,    weight: 0.01 },
  { first: ITSEKIRI_FIRST, last: ITSEKIRI_LAST, weight: 0.01 },
  { first: NUPE_FIRST,     last: NUPE_LAST,     weight: 0.01 },
  { first: KANURI_FIRST,   last: KANURI_LAST,   weight: 0.01 },
  { first: IGALA_FIRST,    last: IGALA_LAST,    weight: 0.01 },
  { first: EBIRA_FIRST,    last: EBIRA_LAST,    weight: 0.01 },
  { first: IDOMA_FIRST,    last: IDOMA_LAST,    weight: 0.01 },
  { first: OGONI_FIRST,    last: OGONI_LAST,    weight: 0.01 },
  { first: IKWERRE_FIRST,  last: IKWERRE_LAST,  weight: 0.01 },
  { first: ANNANG_FIRST,   last: ANNANG_LAST,   weight: 0.005 },
  { first: JUKUN_FIRST,    last: JUKUN_LAST,    weight: 0.005 },
];

const pickWriter = (): string => {
  // English names get cross-tribe surname (last 1% bucket)
  if (Math.random() > 0.99) {
    const f = ENGLISH_FIRST[Math.floor(Math.random() * ENGLISH_FIRST.length)];
    const l = ALL_LAST[Math.floor(Math.random() * ALL_LAST.length)];
    return `${f} ${l}`;
  }
  // Weighted tribe selection
  let roll = Math.random();
  for (const tribe of TRIBE_POOL) {
    roll -= tribe.weight;
    if (roll <= 0) {
      const f = tribe.first[Math.floor(Math.random() * tribe.first.length)];
      const l = tribe.last[Math.floor(Math.random() * tribe.last.length)];
      return `${f} ${l}`;
    }
  }
  // Fallback (floating point rounding)
  const t = TRIBE_POOL[0];
  return `${t.first[Math.floor(Math.random() * t.first.length)]} ${t.last[Math.floor(Math.random() * t.last.length)]}`;
};


const LEVEL_BADGE: Record<string, string> = {
  PhD: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  MSc: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  BSc: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};

const levelBadgeClass = (lvl: string) => LEVEL_BADGE[lvl] || LEVEL_BADGE.BSc;

export default function ProjectsPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [depts, setDepts] = useState<{ department: string; count: number }[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [dept, setDept] = useState('all');
  const [level, setLevel] = useState('all');

  const [preview, setPreview] = useState<Topic | null>(null);
  const [cart, setCart] = useState<Cart | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<Set<number>>(new Set());
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [busy, setBusy] = useState(false);

  // Secure Document Preview States & Effects
  const [userEmail, setUserEmail] = useState('');
  const [isWindowBlurred, setIsWindowBlurred] = useState(false);
  const [previewPage, setPreviewPage] = useState(1);
  const [previewZoom, setPreviewZoom] = useState(100);

  useEffect(() => {
    if (!preview) return;
    setPreviewPage(1);
    setIsWindowBlurred(false);

    // Prevent copying
    const preventCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      alert("Copying text is disabled in the secure document viewer. Please purchase the project material to download the complete file.");
    };

    // Prevent keyboard copy/selection shortcuts and PrintScreen
    const preventKeys = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;
      if (
        (isCmdOrCtrl && ['c', 'a', 's', 'p', 'x'].includes(e.key.toLowerCase())) ||
        e.key === 'PrintScreen' || 
        e.key === 'Snapshot'
      ) {
        e.preventDefault();
        alert("This operation is disabled in the secure document viewer. Please purchase the material to unlock.");
      }
    };

    const preventDrag = (e: DragEvent) => {
      e.preventDefault();
    };

    document.addEventListener('copy', preventCopy);
    document.addEventListener('keydown', preventKeys);
    document.addEventListener('dragstart', preventDrag);

    // Dynamic blur protection when focus is lost (blocks screenshot/snip programs)
    const handleBlur = () => {
      setIsWindowBlurred(true);
    };
    const handleFocus = () => {
      setIsWindowBlurred(false);
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('copy', preventCopy);
      document.removeEventListener('keydown', preventKeys);
      document.removeEventListener('dragstart', preventDrag);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [preview]);

  const getFaculty = (dept: string) => {
    const d = dept.toLowerCase();
    if (d.includes('computer') || d.includes('science') || d.includes('microbiology') || d.includes('biochemistry') || d.includes('math') || d.includes('geology') || d.includes('chemistry') || d.includes('biology') || d.includes('botany')) return 'Science';
    if (d.includes('engineering') || d.includes('technology')) return 'Engineering and Technology';
    if (d.includes('accounting') || d.includes('business') || d.includes('finance') || d.includes('admin') || d.includes('actuarial') || d.includes('insurance')) return 'Management Sciences';
    if (d.includes('law')) return 'Law';
    if (d.includes('nursing') || d.includes('anatomy') || d.includes('medicine') || d.includes('dentistry') || d.includes('medical')) return 'Basic Medical Sciences';
    if (d.includes('education')) return 'Education';
    if (d.includes('economics') || d.includes('mass') || d.includes('sociology') || d.includes('geography') || d.includes('relation') || d.includes('political')) return 'Social Sciences';
    if (d.includes('english') || d.includes('history') || d.includes('linguistics') || d.includes('art') || d.includes('music')) return 'Arts';
    if (d.includes('agric') || d.includes('animal') || d.includes('fisheries') || d.includes('forestry')) return 'Agriculture';
    return 'Social & Management Sciences';
  };

  const getCleanTitle = (title: string) => {
    return title.replace(/^\[PROJECT\]\s*/i, '').trim().toUpperCase();
  };

  const generateProjectPreview = (title: string, dept: string, lvl: string) => {
    const cleanTitle = getCleanTitle(title);
    const deptUpper = dept.toUpperCase();
    
    const abstract = `This study investigates the critical dimensions of "${cleanTitle}" within the contemporary Nigerian environment. The main objective of the study was to evaluate how variables underlying the subject impact productivity, efficiency, and policy execution in the target domain. The research design employed was a descriptive survey design. A sample size of 150 respondents was selected from the target population using simple random sampling techniques. Data collection was done using a structured questionnaire titled "${cleanTitle} Questionnaire" which was validated by academic experts in the Department of ${deptUpper}. The collected data were analyzed using statistical package for social sciences (SPSS) with descriptive statistics (mean and standard deviation) and inferential statistics (Chi-Square/Regression analysis). The findings revealed that ${cleanTitle} has a statistically significant positive effect on organizational performance and development in Nigeria. Based on the findings, it is recommended that stakeholders should prioritize implementation of policies that support these parameters to foster sustainable national development.`;
    
    const background = `In recent years, the concept of ${cleanTitle} has gained prominent attention across various sectors of the Nigerian economy. In the era of globalization and rapid technological advancement, the integration of effective methodologies within ${deptUpper} has become a core prerequisite for national growth.

Historically, Nigeria has faced unique challenges related to infrastructure, policy consistency, and socio-economic variables. The application of ${cleanTitle} offers a strategic pathway to mitigate these systemic inefficiencies. Previous studies by Nigerian researchers like Alao (2021) and Chukwu (2023) emphasize that without adequate structures to support these paradigms, achieving sustainable development remains a mirage. Therefore, this study attempts to fill the gap in literature by examining the empirical impact of ${cleanTitle} in the Nigerian context.`;

    const problem = `Despite the potential benefits associated with ${cleanTitle}, there is a notable deficit in its practical application and empirical documentation in Nigeria. Many organizations and institutions continue to rely on obsolete frameworks, leading to low productivity, poor outcomes, and wasted resources.

Furthermore, there is a lack of localized research that addresses the specific cultural, political, and economic nuances of implementing ${cleanTitle} in Nigeria. This gap in knowledge creates a significant problem for policy makers and administrators who require evidence-based data to make informed decisions. This study is therefore designed to address this problem by conducting a detailed analysis of ${cleanTitle}.`;

    const words = cleanTitle.split(' ').filter(w => w.length > 3);
    const varA = words.slice(0, Math.min(3, words.length)).join(' ') || cleanTitle;
    const varB = 'Organizational Performance and Institutional Development';
    const caseStudy = `selected ${dept} organizations in Lagos State, Nigeria`;

    return { abstract, background, problem, varA, varB, caseStudy };
  };

  // Writer match simulation states
  const [simulationState, setSimulationState] = useState<'searching' | 'bidding' | 'awarding' | 'complete' | 'idle'>('idle');
  const [availableWriters, setAvailableWriters] = useState(0);
  const [biddingWriters, setBiddingWriters] = useState(0);
  const [assignedWriter, setAssignedWriter] = useState('');

  useEffect(() => {
    if (cart) {
      setSimulationState('searching');
      setAssignedWriter('');
      
      const t1 = setTimeout(() => {
        const avail = Math.floor(Math.random() * 10) + 12; // 12 to 21 available
        const bid = Math.floor(Math.random() * 5) + 6; // 6 to 10 bidding
        setAvailableWriters(avail);
        setBiddingWriters(Math.min(bid, avail - 2));
        setSimulationState('bidding');
        
        const t2 = setTimeout(() => {
          setSimulationState('awarding');
          
          const t3 = setTimeout(() => {
            setAssignedWriter(pickWriter());
            setSimulationState('complete');
          }, 1600); // 1.6s delay representing awarding selection
          
          return () => clearTimeout(t3);
        }, 1500); // 1.5s delay showing bid count
        
        return () => clearTimeout(t2);
      }, 1600); // 1.6s searching spinner
      
      return () => {
        clearTimeout(t1);
      };
    } else {
      setSimulationState('idle');
    }
  }, [cart]);

  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [customLevel, setCustomLevel] = useState('BSc');
  const [customDept, setCustomDept] = useState('General');
  const [customCard, setCustomCard] = useState<{ title: string; level: string; department: string } | null>(null);
  const [msg, setMsg] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Search states
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedSearchDept, setSelectedSearchDept] = useState('all');
  const [selectedSearchLevel, setSelectedSearchLevel] = useState('all');

  const [sessionSeed, setSessionSeed] = useState(() => Math.random());
  const [levelPrices, setLevelPrices] = useState<Record<string, number>>({ BSc: 3999, MSc: 4500, PhD: 10000 });
  const [deptPrices, setDeptPrices] = useState<Record<string, number>>({});
  const [pageSettings, setPageSettings] = useState<any>({
    hero_title: "Project Topics & Research Materials",
    hero_description: "Thousands of ready-made materials across every Nigerian department — full Chapters 1–5, in MS Word, delivered to your secure vault.",
    features: ["Chapters 1–5", "Working hours 8am–7pm", "4-hour delivery"],
    disclaimer_text: "Please note: these are ready-made materials — we do not check or guarantee plagiarism/similarity or AI-detection levels on them. Purchasing simply means the project will be delivered as-is. Need a plagiarism-free, AI-free custom write-up? Use our main writing service →",
    checkout_terms: "I understand this is a ready-made material — similarity/plagiarism and AI-detection levels are not checked or guaranteed. My purchase means the project will be delivered (Chapters 1–5, MS Word) to my vault. Working hours are 8am–7pm; delivery is within 4 hours.",
    delivery_text: "Delivered within 4 hours",
    show_random: true
  });

  const [addonWords, setAddonWords] = useState<Record<number, number>>({});
  const [addonFeatures, setAddonFeatures] = useState<Record<number, string[]>>({});
  const [customLocation, setCustomLocation] = useState('');

  const [copiedId, setCopiedId] = useState<number | null>(null);
  const slugify = (title: string) =>
    title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);
  const copyPermalink = (topicId: number, title: string) => {
    const link = `${window.location.origin}/projects/${topicId}-${slugify(title)}`;
    navigator.clipboard.writeText(link);
    setCopiedId(topicId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const mergedDepts = useCallback(() => {
    const dbDepts = depts.map(d => d.department);
    const set = new Set([...dbDepts, ...NIGERIAN_DEPARTMENTS]);
    return Array.from(set).sort();
  }, [depts])();

  const browseFilterOptions = {
    dept: [{ value: 'all', label: 'All Departments' }, ...mergedDepts.map(d => ({ value: d, label: d }))],
    level: [
      { value: 'all', label: 'All Levels' },
      { value: 'BSc', label: 'BSc / HND' },
      { value: 'MSc', label: 'MSc / PGD' },
      { value: 'PhD', label: 'PhD' },
    ],
  };

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setIsLoggedIn(!!user);
      if (user?.email) setUserEmail(user.email);

      // Load settings
      const { data: settingsData } = await supabase.from('project_settings').select('*');
      if (settingsData) {
        let lp = { BSc: 3999, MSc: 4500, PhD: 10000 };
        let dp = {};
        let ps = { ...pageSettings };
        settingsData.forEach(s => {
          if (s.key === 'level_prices') lp = s.value;
          if (s.key === 'department_prices') dp = s.value;
          if (s.key === 'page_settings') ps = { ...ps, ...s.value };
        });
        setLevelPrices(lp);
        setDeptPrices(dp);
        setPageSettings(ps);
      }

      const [{ data: d }, { data: a }] = await Promise.all([
        supabase.from('project_topic_departments').select('*'),
        supabase.from('project_addons').select('id, name, description, price, price_type, features, is_location_changer').eq('is_active', true).order('sort_order'),
      ]);
      setDepts((d as any[]) || []);
      setAddons((a as Addon[]) || []);
    })();
  }, []);

  // Compute pricing fallback
  const getTopicPrice = useCallback((lvl: string, deptName: string, customPrice?: number) => {
    if (customPrice !== undefined && Number(customPrice) > 0) return Number(customPrice);
    const deptPrice = deptPrices[deptName];
    if (deptPrice !== undefined && Number(deptPrice) > 0) return Number(deptPrice);
    return levelPrices[lvl] || levelPrices.BSc || 3999;
  }, [levelPrices, deptPrices]);

  const fetchTopics = useCallback(async (targetPage: number, seedOverride?: number) => {
    const from = (targetPage - 1) * PAGE_SIZE;

    // Get count first
    let countQuery = supabase.from('project_topics').select('*', { count: 'exact', head: true }).eq('is_active', true);
    if (dept !== 'all') countQuery = countQuery.eq('department', dept);
    if (level !== 'all') countQuery = countQuery.eq('level', level);
    if (debounced.trim()) countQuery = countQuery.ilike('title', `%${debounced.trim()}%`);
    const { count } = await countQuery;
    setTotal(count || 0);

    let data: Topic[] | null = null;
    let error: any = null;

    if (pageSettings.show_random) {
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_project_topics_random', {
        p_seed: seedOverride ?? sessionSeed,
        p_dept: dept,
        p_level: level,
        p_search: debounced.trim(),
        p_limit: PAGE_SIZE,
        p_offset: from
      });
      data = rpcData;
      error = rpcError;
    }

    // Fallback if rpc is not found or fails
    if (!data || error) {
      let q = supabase.from('project_topics').select('*').eq('is_active', true);
      if (dept !== 'all') q = q.eq('department', dept);
      if (level !== 'all') q = q.eq('level', level);
      if (debounced.trim()) q = q.ilike('title', `%${debounced.trim()}%`);
      q = q.order('id', { ascending: true }).range(from, from + PAGE_SIZE - 1);
      const { data: selectData } = await q;
      data = selectData as Topic[];
    }

    // Map dynamic prices onto the topics
    const mapped = (data || []).map(t => ({
      ...t,
      price: getTopicPrice(t.level, t.department, t.price)
    }));

    setTopics(mapped);
    setPage(targetPage);
  }, [dept, level, debounced, sessionSeed, pageSettings.show_random, getTopicPrice]);

  const handlePageChange = (p: number) => {
    const totalPages = Math.ceil(total / PAGE_SIZE);
    if (p < 1 || p > totalPages) return;
    setLoading(true);
    fetchTopics(p).finally(() => {
      setLoading(false);
      document.getElementById('topics-grid')?.scrollIntoView({ behavior: 'smooth' });
    });
  };

  const executeAvailabilitySearch = async () => {
    if (!search.trim()) return;
    setIsSearching(true);
    setMsg('');
    
    // Sync filter state
    setDept(selectedSearchDept);
    setLevel(selectedSearchLevel);
    
    // Simulated loading delay for premium feel
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    try {
      setDebounced(search.trim());
      setHasSearched(true);
    } catch (err) {
      console.error(err);
      setMsg('Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchTopics(1).finally(() => setLoading(false));
  }, [dept, level, debounced, hasSearched]);

  // ---- checkout ----
  const openCart = (c: Cart) => {
    setPreview(null);
    setSelectedAddons(new Set());
    setAddonWords({});
    setAddonFeatures({});
    setCustomLocation('');
    setAcceptedTerms(false);
    setMsg('');
    setCart(c);
  };

  const cartTotal = () => {
    if (!cart) return 0;
    let t = cart.basePrice;
    addons.forEach(a => {
      if (selectedAddons.has(a.id)) {
        if (a.price_type === 'per_word') {
          const w = addonWords[a.id] || 1000;
          t += Number(a.price) * w;
        } else {
          t += Number(a.price);
        }

        // Add features
        if (Array.isArray(a.features) && addonFeatures[a.id]) {
          a.features.forEach(f => {
            if (addonFeatures[a.id].includes(f.name)) {
              t += Number(f.price);
            }
          });
        }
      }
    });
    return Math.round(t);
  };

  const pay = async () => {
    if (!cart || !acceptedTerms) return;
    if (isLoggedIn === false && !EMAIL_RE.test(guestEmail.trim())) {
      setMsg('Please enter a valid email — your receipt and vault access link go there.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/projects/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId: cart.topicId,
          customTitle: cart.customTitle,
          department: cart.department,
          level: cart.level,
          addonIds: Array.from(selectedAddons),
          addonWords: addonWords,
          addonFeatures: addonFeatures,
          customLocation: customLocation,
          assignedWriter: assignedWriter || undefined,
          email: isLoggedIn === false ? guestEmail.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.authorization_url) window.location.href = data.authorization_url;
      else setMsg(data.error || 'Could not start checkout.');
    } catch { setMsg('Network error. Please try again.'); }
    setBusy(false);
  };

  const checkCustomAvailability = () => {
    if (customTitle.trim().length < 5) { setMsg('Please enter a fuller topic title.'); return; }
    setMsg('');
    setCustomCard({ title: customTitle.trim(), level: customLevel, department: customDept });
    // Reshuffle the catalogue behind it too, same as a full page reload.
    const newSeed = Math.random();
    setSessionSeed(newSeed);
    fetchTopics(page, newSeed);
  };

  // Title difference highlighters for similar searches
  const renderTitleWithDifferences = (title: string) => {
    const cleanWords = (t: string) =>
      t.toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
        .split(/\s+/)
        .filter(Boolean);

    const words = cleanWords(title);
    const wordsSet = new Set(words);
    if (words.length === 0) return title;

    let bestMatchTitle = "";
    let bestOverlap = 0;

    topics.forEach(other => {
      if (other.title === title) return;
      const otherWords = cleanWords(other.title);
      if (otherWords.length === 0) return;
      const common = otherWords.filter(w => wordsSet.has(w));
      const overlap = common.length / Math.max(words.length, otherWords.length);
      if (overlap > bestOverlap && overlap > 0.45 && overlap < 0.98) {
        bestOverlap = overlap;
        bestMatchTitle = other.title;
      }
    });

    if (bestOverlap > 0.45 && bestMatchTitle) {
      const otherWordsSet = new Set(cleanWords(bestMatchTitle));
      const tokens = title.split(/(\s+)/);
      return tokens.map((token, idx) => {
        const cleanToken = token.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").trim();
        if (cleanToken && !otherWordsSet.has(cleanToken)) {
          return (
            <span key={idx} className="text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/25 font-extrabold shadow-sm text-xs select-none">
              {token}
            </span>
          );
        }
        return token;
      });
    }
    return title;
  };

  const deptOptions = [{ value: 'all', label: 'All Departments' }, ...mergedDepts.map(d => ({ value: d, label: d }))];
  const levelOptions = [
    { value: 'all', label: 'All Levels' },
    { value: 'BSc', label: 'BSc / HND' },
    { value: 'MSc', label: 'MSc / PGD' },
    { value: 'PhD', label: 'PhD' },
  ];

  return (
    <div className="min-h-screen bg-primary text-primary overflow-x-hidden">
      <Header projectsContext />
      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-700 via-emerald-600 to-emerald-800 text-white">
        <div className="absolute -top-16 -right-20 w-72 h-72 rounded-full bg-white/5 animate-blob" />
        <div className="absolute -bottom-24 -left-16 w-96 h-96 rounded-full bg-white/[0.03] animate-blob animation-delay-2000" />
        <Shell size="md" className="text-center pt-header-24 sm:pt-header-28 pb-12 relative z-10 space-y-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mb-2">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <h1 className="font-display italic font-medium text-3xl md:text-4xl lg:text-5xl">
            {pageSettings.hero_title}
          </h1>
          <p className="text-sm md:text-base opacity-90 max-w-2xl mx-auto">
            {pageSettings.hero_description}
          </p>
          <div className="flex gap-2 justify-center flex-wrap text-xs font-bold">
            {Array.isArray(pageSettings.features) && pageSettings.features.map((f: string, i: number) => (
              <Badge key={i} variant="default" className="bg-white/15 border-white/20 text-white">{f}</Badge>
            ))}
            <Badge variant="default" className="bg-white/15 border-white/20 text-white">
              BSc {naira(levelPrices.BSc)} · MSc {naira(levelPrices.MSc)} · PhD {naira(levelPrices.PhD)}
            </Badge>
          </div>

          {/* DATABASE SEARCH CARD MOVED HERE */}
          {!hasSearched && !isSearching ? (
            <div className="max-w-2xl mx-auto mt-6 text-left">
              <Card padding="lg" elevation={3} className="text-primary">
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold text-primary">Database Search & Availability</h2>
                  <p className="text-xs text-secondary mt-1.5 leading-relaxed font-semibold">
                    Place your full project topic below to search our database of 100,000+ completed projects and check instant availability.
                  </p>
                </div>

                <div className="space-y-4 text-left">
                  <Textarea
                    label="Your Full Project Topic *"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="e.g. Challenges and prospects of financial autonomy to local government administration..."
                    rows={3}
                    fullWidth
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select
                      label="Department"
                      value={selectedSearchDept}
                      onChange={e => setSelectedSearchDept(e.target.value)}
                      options={deptOptions}
                    />
                    <Select
                      label="Academic Level"
                      value={selectedSearchLevel}
                      onChange={e => setSelectedSearchLevel(e.target.value)}
                      options={levelOptions}
                    />
                  </div>

                  <Button
                    onClick={executeAvailabilitySearch}
                    disabled={!search.trim() || isSearching}
                    fullWidth
                    size="lg"
                  >
                    Check Availability & Retrieve Material
                  </Button>
                </div>
              </Card>
            </div>
          ) : hasSearched && !isSearching ? (
            loading ? (
              <Card padding="lg" elevation={3} className="max-w-md mx-auto mt-6 text-center">
                <Loader2 className="w-10 h-10 animate-spin mx-auto text-accent mb-4" />
                <h3 className="text-sm font-bold text-primary">Loading matching topics...</h3>
              </Card>
            ) : topics.length === 0 ? (
              /* NO DIRECT RESULTS - SHOW CUSTOM WRITEUP CARD HERE IN HERO */
              <Card padding="lg" elevation={3} className="max-w-2xl mx-auto mt-6 text-center">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-theme pb-4 text-left mb-6">
                  <div>
                    <h3 className="text-sm font-bold text-primary">Search Results</h3>
                    <p className="text-xs text-secondary mt-0.5">Availability results for: <span className="text-primary italic font-bold">"{search}"</span></p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => { setHasSearched(false); setIsSearching(false); setTopics([]); setCustomCard(null); }}>
                    <Search className="w-3.5 h-3.5" /> Search Another Topic
                  </Button>
                </div>

                <div className="w-14 h-14 bg-success/10 text-success rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h4 className="text-lg font-bold text-primary mb-2">Custom Write-up Available!</h4>
                <p className="text-xs text-secondary mb-6 leading-relaxed max-w-md mx-auto font-semibold">
                  Our writers can prepare your custom topic as an original project with complete Chapters 1–5, structured layout, and full references.
                </p>

                <Card padding="md" className="text-left space-y-4 max-w-lg mx-auto mb-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="success">Available</Badge>
                    <Badge variant="default">{selectedSearchLevel === 'all' ? 'BSc' : selectedSearchLevel}</Badge>
                    <Badge variant="default">{selectedSearchDept === 'all' ? 'General' : selectedSearchDept}</Badge>
                  </div>
                  <p className="text-xs font-bold text-primary leading-normal break-words">{search}</p>
                  <div className="border-t border-theme pt-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    <div>
                      <span className="text-[10px] text-secondary uppercase font-bold block">Standard Cost</span>
                      <span className="text-sm font-mono font-bold text-success">{naira(getTopicPrice(selectedSearchLevel === 'all' ? 'BSc' : selectedSearchLevel, selectedSearchDept === 'all' ? 'General' : selectedSearchDept))}</span>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => openCart({
                        customTitle: search.trim(),
                        level: selectedSearchLevel === 'all' ? 'BSc' : selectedSearchLevel,
                        department: selectedSearchDept === 'all' ? 'General' : selectedSearchDept,
                        title: search.trim(),
                        basePrice: getTopicPrice(selectedSearchLevel === 'all' ? 'BSc' : selectedSearchLevel, selectedSearchDept === 'all' ? 'General' : selectedSearchDept)
                      })}
                    >
                      Order Custom Write-up
                    </Button>
                  </div>
                </Card>
              </Card>
            ) : (
              /* DIRECT MATCHES FOUND - SHOW THE COMPACT SEARCH RESULTS BANNER */
              <Card padding="md" elevation={2} className="max-w-2xl mx-auto mt-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 text-left">
                <div>
                  <h3 className="text-sm font-bold text-primary">Search Results</h3>
                  <p className="text-xs text-secondary mt-0.5">Availability results for: <span className="text-primary italic font-bold">"{search}"</span></p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => { setHasSearched(false); setIsSearching(false); setTopics([]); setCustomCard(null); }}>
                  <Search className="w-3.5 h-3.5" /> Search Another Topic
                </Button>
              </Card>
            )
          ) : isSearching ? (
            <Card padding="lg" elevation={3} className="max-w-md mx-auto mt-10 text-center">
              <Loader2 className="w-10 h-10 animate-spin mx-auto text-accent mb-4" />
              <h3 className="text-sm font-bold text-primary">Scanning Project Database...</h3>
              <p className="text-xs text-secondary mt-1">Checking chapters, tables, and references availability for your topic.</p>
            </Card>
          ) : null}
        </Shell>
      </section>

      {/* SERVICES (project-topics specific) */}
      <section id="services" className="px-4 md:px-6 py-10 border-b border-theme">
        <Shell size="lg">
          <h2 className="text-lg md:text-xl font-bold text-primary text-center mb-6">What's Included With Every Topic</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card padding="lg" className="text-center">
              <div className="w-10 h-10 rounded-xl bg-secondary border border-theme flex items-center justify-center mx-auto mb-3 text-accent">
                <ScrollText className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-primary mb-1">Ready-made Chapters 1–5</h3>
              <p className="text-xs text-secondary">Full academic material in MS Word, matched to your department and level.</p>
            </Card>
            <Card padding="lg" className="text-center">
              <div className="w-10 h-10 rounded-xl bg-secondary border border-theme flex items-center justify-center mx-auto mb-3 text-warning">
                <Puzzle className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-primary mb-1">Optional Add-ons</h3>
              <p className="text-xs text-secondary">Extend any topic with extras like SPSS analysis, PowerPoint slides, or a location/case-study change.</p>
            </Card>
            <Card padding="lg" className="text-center">
              <div className="w-10 h-10 rounded-xl bg-secondary border border-theme flex items-center justify-center mx-auto mb-3 text-info">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-primary mb-1">Secure Vault Delivery</h3>
              <p className="text-xs text-secondary">Your material lands in your dashboard's Secure Vault, ready to download.</p>
            </Card>
          </div>
        </Shell>
      </section>

      {/* HOW IT WORKS (project-topics specific) */}
      <section id="how-it-works" className="px-4 md:px-6 py-10 border-b border-theme bg-card/30">
        <Shell size="lg">
          <h2 className="text-lg md:text-xl font-bold text-primary text-center mb-6">How It Works</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { n: '1', label: 'Pick a Topic', desc: 'Browse or search 100,000+ ready-made topics.' },
              { n: '2', label: 'Choose Add-ons', desc: 'Extend it with optional extras if you need them.' },
              { n: '3', label: 'Pay Securely', desc: 'Checkout with card — no account required upfront.' },
              { n: '4', label: 'Get Delivered', desc: 'Material lands in your Secure Vault within hours.' },
            ].map(step => (
              <Card key={step.n} padding="md" className="text-center">
                <div className="w-9 h-9 mx-auto mb-2 rounded-full bg-accent text-[var(--accent-foreground)] font-black flex items-center justify-center text-sm">{step.n}</div>
                <h4 className="text-xs font-bold text-primary mb-1">{step.label}</h4>
                <p className="text-[11px] text-secondary leading-relaxed">{step.desc}</p>
              </Card>
            ))}
          </div>
        </Shell>
      </section>

      {/* DISCLAIMER */}
      <div className="bg-[var(--warning-bg)] border-b border-warning/20 px-4 md:px-6 py-3">
        <Shell size="lg" className="flex items-start gap-2 text-xs md:text-sm text-warning">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            {pageSettings.disclaimer_text.includes("Use our main writing service") ? (
              <>
                <strong>Please note:</strong> these are ready-made materials — we do <strong>not</strong> check or guarantee plagiarism/similarity or AI-detection levels on them. Purchasing simply means the project <strong>will be delivered</strong> as-is. Need a <strong>plagiarism-free, AI-free</strong> custom write-up? {' '}
                <Link href="/order/academic" className="underline font-bold">Use our main writing service →</Link>
              </>
            ) : pageSettings.disclaimer_text}
          </p>
        </Shell>
      </div>

      {/* DATABASE SEARCH & AVAILABILITY RESULTS CONTAINER */}
      {hasSearched && !isSearching && !loading && topics.length > 0 && (
        <Shell size="full" className="max-w-[1320px] py-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-theme pb-4">
            <div>
              <h3 className="text-lg font-bold text-primary">Matching Database Topics</h3>
              <p className="text-xs text-secondary mt-0.5">Availability results for: <span className="text-primary italic font-bold">"{search}"</span></p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => { setHasSearched(false); setIsSearching(false); setTopics([]); setCustomCard(null); }}>
              <Search className="w-3.5 h-3.5" /> Search Another Topic
            </Button>
          </div>

          {msg && !cart && <div className="mb-4 text-xs font-bold text-danger bg-[var(--danger-bg)] border border-danger/20 rounded-xl p-3">{msg}</div>}

          <div id="topics-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
            {topics.map(t => (
              <Card key={t.id} padding="md" interactive className="flex flex-col gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="success">{t.department}</Badge>
                  <Badge variant="default" className={levelBadgeClass(t.level)}>{t.level}</Badge>
                </div>
                <h3 className="text-sm font-bold leading-relaxed text-primary line-clamp-3">
                  {renderTitleWithDifferences(t.title)}
                </h3>
                <div className="flex gap-x-3 gap-y-1 flex-wrap text-[11px] text-secondary font-mono">
                  <span className="inline-flex items-center gap-1"><FileText className="w-3 h-3" /> {t.pages || '—'} pages</span>
                  <span className="inline-flex items-center gap-1"><ScrollText className="w-3 h-3" /> Ch. {t.chapters}</span>
                  <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" /> {t.year}</span>
                  <span className="inline-flex items-center gap-1"><Zap className="w-3 h-3" /> {t.format}</span>
                </div>
                <Badge variant="warning" className="w-fit">{pageSettings.delivery_text}</Badge>
                <div className="flex gap-2 mt-auto pt-1 flex-wrap">
                  <Button variant="secondary" size="sm" className="flex-1 min-w-[70px]" onClick={() => setPreview(t)}><Eye className="w-3.5 h-3.5" /> Preview</Button>
                  <Button variant="secondary" size="sm" className="whitespace-nowrap" onClick={() => copyPermalink(t.id, t.title)}>
                    {copiedId === t.id ? <><CheckCircle2 className="w-3.5 h-3.5" /> Copied</> : <><Share2 className="w-3.5 h-3.5" /> Share</>}
                  </Button>
                  <Button size="sm" className="flex-1 min-w-[90px]" onClick={() => openCart({ topicId: t.id, department: t.department, level: t.level, title: t.title, basePrice: Number(t.price) })}>Get · {naira(t.price)}</Button>
                </div>
              </Card>
            ))}
          </div>

          {/* PAGINATION BAR */}
          {Math.ceil(total / PAGE_SIZE) > 1 && (
            <div className="flex justify-center items-center gap-2 mt-8 flex-wrap">
              <Button
                variant="secondary"
                size="sm"
                disabled={page === 1 || loading}
                onClick={() => handlePageChange(page - 1)}
              >
                Prev
              </Button>

              {Array.from({ length: Math.min(5, Math.ceil(total / PAGE_SIZE)) }, (_, i) => {
                const totalPages = Math.ceil(total / PAGE_SIZE);
                let pageNum = page - 2 + i;
                if (page <= 2) pageNum = i + 1;
                if (page >= totalPages - 1) pageNum = totalPages - 4 + i;
                pageNum = Math.max(1, Math.min(pageNum, totalPages));

                if (pageNum < 1 || pageNum > totalPages) return null;

                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`w-9 h-9 rounded-xl text-xs font-bold transition ${page === pageNum ? 'bg-accent text-[var(--accent-foreground)]' : 'bg-secondary border border-theme text-primary hover:bg-hover'}`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <Button
                variant="secondary"
                size="sm"
                disabled={page === Math.ceil(total / PAGE_SIZE) || loading}
                onClick={() => handlePageChange(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </Shell>
      )}

      {/* BROWSE ALL PROJECT TOPICS (below search section) */}
      {!hasSearched && !isSearching && (
        <Shell size="full" className="max-w-[1320px] pb-16">
          {/* Filter Row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
            <div>
              <h2 className="text-lg font-bold text-primary">Browse Available Topics</h2>
              <p className="text-xs text-secondary mt-0.5">
                {total > 0 ? `${total.toLocaleString()} topics in our database` : 'Loading topics…'}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select
                value={dept}
                onChange={e => { setDept(e.target.value); setPage(1); }}
                options={browseFilterOptions.dept}
                className="w-44 text-xs"
              />
              <Select
                value={level}
                onChange={e => { setLevel(e.target.value); setPage(1); }}
                options={browseFilterOptions.level}
                className="w-36 text-xs"
              />
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center text-secondary text-sm flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading topics…
            </div>
          ) : topics.length === 0 ? (
            <EmptyState
              icon={<Search className="w-5 h-5" />}
              title="No topics found"
              description="Try a different department or level."
            />
          ) : (
            <>
              <div id="topics-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {topics.map(t => (
                  <Card key={t.id} padding="md" interactive className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="success">{t.department}</Badge>
                      <Badge variant="default" className={levelBadgeClass(t.level)}>{t.level}</Badge>
                    </div>
                    <h3 className="text-sm font-bold leading-relaxed text-primary line-clamp-3">
                      {renderTitleWithDifferences(t.title)}
                    </h3>
                    <div className="flex gap-x-3 gap-y-1 flex-wrap text-[11px] text-secondary font-mono">
                      <span className="inline-flex items-center gap-1"><FileText className="w-3 h-3" /> {t.pages || '—'} pages</span>
                      <span className="inline-flex items-center gap-1"><ScrollText className="w-3 h-3" /> Ch. {t.chapters}</span>
                      <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" /> {t.year}</span>
                      <span className="inline-flex items-center gap-1"><Zap className="w-3 h-3" /> {t.format}</span>
                    </div>
                    <Badge variant="warning" className="w-fit">{pageSettings.delivery_text}</Badge>
                    <div className="flex gap-2 mt-auto pt-1 flex-wrap">
                      <Button variant="secondary" size="sm" className="flex-1 min-w-[70px]" onClick={() => setPreview(t)}><Eye className="w-3.5 h-3.5" /> Preview</Button>
                      <Button variant="secondary" size="sm" className="whitespace-nowrap" onClick={() => copyPermalink(t.id, t.title)}>
                        {copiedId === t.id ? <><CheckCircle2 className="w-3.5 h-3.5" /> Copied</> : <><Share2 className="w-3.5 h-3.5" /> Share</>}
                      </Button>
                      <Button size="sm" className="flex-1 min-w-[90px]" onClick={() => openCart({ topicId: t.id, department: t.department, level: t.level, title: t.title, basePrice: Number(t.price) })}>Get · {naira(t.price)}</Button>
                    </div>
                  </Card>
                ))}
              </div>

              {Math.ceil(total / PAGE_SIZE) > 1 && (
                <div className="flex justify-center items-center gap-2 mt-8 flex-wrap">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page === 1 || loading}
                    onClick={() => handlePageChange(page - 1)}
                  >Prev</Button>
                  {Array.from({ length: Math.min(5, Math.ceil(total / PAGE_SIZE)) }, (_, i) => {
                    const totalPages = Math.ceil(total / PAGE_SIZE);
                    let p: number;
                    if (totalPages <= 5) { p = i + 1; }
                    else if (page <= 3) { p = i + 1; }
                    else if (page >= totalPages - 2) { p = totalPages - 4 + i; }
                    else { p = page - 2 + i; }
                    return (
                      <button key={p} onClick={() => handlePageChange(p)}
                        className={`px-4 py-2 rounded-xl border text-xs font-bold transition ${p === page ? 'bg-accent text-[var(--accent-foreground)] border-accent' : 'bg-secondary border-theme text-primary hover:bg-hover'}`}
                      >{p}</button>
                    );
                  })}
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page === Math.ceil(total / PAGE_SIZE) || loading}
                    onClick={() => handlePageChange(page + 1)}
                  >Next</Button>
                </div>
              )}
            </>
          )}
        </Shell>
      )}

      {/* PREVIEW MODAL */}

      {preview && (() => {
        const previewData = generateProjectPreview(preview.title, preview.department, preview.level);
        const cleanTitle = getCleanTitle(preview.title);

        /* Reusable lock overlay for locked pages */
        const LockOverlay = ({ label, cta }: { label: string; cta?: string }) => (
          <div className="absolute inset-0 bg-zinc-950/15 backdrop-blur-[5px] flex flex-col items-center justify-center p-4 sm:p-6 text-center z-20">
            <div className="bg-white/95 border border-zinc-200 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-2xl max-w-xs sm:max-w-sm w-full flex flex-col items-center gap-2 sm:gap-3">
              <lucide.Lock className="w-6 h-6 sm:w-8 sm:h-8 text-amber-500 animate-pulse" />
              <h4 className="text-zinc-950 font-black text-[10px] sm:text-xs uppercase tracking-wider leading-tight">{label}</h4>
              <p className="text-zinc-600 text-[9px] sm:text-[10px] leading-relaxed">
                Purchase this project to unlock all 50 pages (Chapters 1–5, MS Word & PDF).
              </p>
              <button 
                onClick={() => {
                  setPreview(null);
                  openCart({
                    topicId: preview.id,
                    department: preview.department,
                    level: preview.level,
                    title: preview.title,
                    basePrice: getTopicPrice(preview.level, preview.department || 'General', Number(preview.price))
                  });
                }} 
                className="mt-1 w-full py-2 sm:py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-[10px] sm:text-xs uppercase rounded-lg tracking-wider transition"
              >
                {cta || 'Get Complete Material'}
              </button>
            </div>
          </div>
        );

        /* Quieter lock for the bulk chapter pages — repeating the full CTA card on all
           42 of them reads as spam, so those get a single centred badge instead. */
        const SubtleLock = ({ label }: { label: string }) => (
          <div className="absolute inset-0 bg-zinc-950/15 backdrop-blur-[5px] flex items-center justify-center p-4 z-20">
            <div className="flex items-center gap-2 bg-white/90 border border-zinc-200 rounded-full px-3 py-1.5 shadow-lg">
              <lucide.Lock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500" />
              <span className="text-zinc-700 font-black text-[8px] sm:text-[9px] uppercase tracking-wider">{label}</span>
            </div>
          </div>
        );

        /* Reusable A4 page wrapper — responsive padding & sizing */
        const A4Page = ({ children, locked, pageNum, className: extra }: { children: React.ReactNode; locked?: boolean; pageNum: number; className?: string }) => (
          <div className={`relative mx-auto w-full max-w-[210mm] bg-white text-zinc-950 border border-zinc-300 shadow-2xl select-none overflow-hidden ${locked ? '' : 'flex flex-col justify-between'} ${extra || ''}`}
               style={{ fontSize: `${previewZoom / 100}em`, aspectRatio: '1/1.414', padding: 'clamp(1.5rem, 4vw, 5rem)' }}>
            {children}
            <div className={`${locked ? 'absolute bottom-2 right-3 sm:bottom-4 sm:right-8' : 'text-right mt-auto pt-2'} text-[8px] sm:text-[9px] text-zinc-400 font-mono`}>
              Page {pageNum} of 50
            </div>
          </div>
        );
        
        return (
          <div className="fixed inset-0 z-[200] bg-black/85 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm" onClick={() => setPreview(null)}>
            <div className="bg-card border border-theme rounded-xl sm:rounded-2xl w-full max-w-5xl max-h-[95vh] sm:max-h-[92vh] flex flex-col shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
              {/* Header — responsive */}
              <div className="p-2.5 sm:p-4 border-b border-theme/50 flex justify-between items-center gap-2 sm:gap-4 bg-secondary/20">
                <div className="flex items-center gap-1.5 sm:gap-3 flex-wrap min-w-0">
                  <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full truncate">{preview.department}</span>
                  <span className={`text-[8px] sm:text-[9px] font-black uppercase px-1.5 sm:px-2 py-0.5 rounded border ${levelBadgeClass(preview.level)}`}>{preview.level}</span>
                  <span className="hidden sm:flex text-[10px] font-bold text-emerald-500 items-center gap-1.5 bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10">
                    <lucide.Lock className="w-3.5 h-3.5" /> SECURE PREVIEW (TITLE PAGE VISIBLE, 49 LOCKED)
                  </span>
                  <span className="flex sm:hidden text-[8px] font-bold text-emerald-500 items-center gap-1 bg-emerald-500/5 px-1.5 py-0.5 rounded border border-emerald-500/10">
                    <lucide.Lock className="w-3 h-3" /> 1 OPEN / 49 LOCKED
                  </span>
                </div>
                
                <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                  <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-white/5 border border-theme rounded-lg text-[10px] font-mono">
                    <button onClick={() => setPreviewZoom(z => Math.max(80, z - 10))} className="w-5 h-5 rounded hover:bg-white/10 font-black text-primary">-</button>
                    <span className="text-primary min-w-[28px] text-center">{previewZoom}%</span>
                    <button onClick={() => setPreviewZoom(z => Math.min(130, z + 10))} className="w-5 h-5 rounded hover:bg-white/10 font-black text-primary">+</button>
                  </div>
                  <button onClick={() => setPreview(null)} className="text-secondary hover:text-primary p-1 bg-white/5 hover:bg-white/10 rounded-lg transition"><lucide.X className="w-4 h-4 sm:w-5 sm:h-5" /></button>
                </div>
              </div>

              {/* Scrollable Document Container — responsive */}
              <div className="flex-1 overflow-y-auto p-2 sm:p-4 md:p-8 bg-zinc-900/50 flex flex-col gap-4 sm:gap-6 select-none"
                   style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' } as React.CSSProperties}
                   onContextMenu={e => e.preventDefault()}
              >
                {/* Focus Lost Lock Shield */}
                {isWindowBlurred && (
                  <div className="fixed inset-0 z-[250] bg-black/90 backdrop-blur-[8px] flex flex-col items-center justify-center p-6 text-center select-none cursor-pointer" onClick={() => setIsWindowBlurred(false)}>
                    <lucide.Lock className="w-10 h-10 sm:w-12 sm:h-12 text-emerald-500 mb-3 animate-bounce" />
                    <h3 className="text-white font-black text-sm sm:text-base uppercase tracking-wider">Preview Hidden</h3>
                    <p className="text-zinc-400 text-[10px] sm:text-xs mt-1 max-w-sm">Window focus lost. Click to resume.</p>
                  </div>
                )}

                {/* Page 1: Cover Page — VISIBLE */}
                <A4Page pageNum={1}>
                  <div className="absolute inset-0 pointer-events-none opacity-[0.02] flex flex-wrap gap-8 sm:gap-12 rotate-[-25deg] justify-center items-center scale-110 z-0">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <span key={i} className="text-[10px] sm:text-sm font-black text-black uppercase tracking-widest font-mono">SECURE PREVIEW • DO NOT COPY</span>
                    ))}
                  </div>
                  <div className="z-10 w-full space-y-6 sm:space-y-12 text-center">
                    <div className="text-[9px] sm:text-xs font-black tracking-wider text-zinc-400 uppercase">RESEARCH WORK ARCHIVE</div>
                    <div className="text-[11px] sm:text-sm md:text-base font-black tracking-wide leading-relaxed font-serif uppercase max-w-lg mx-auto border-y border-zinc-200 py-4 sm:py-6">
                      {cleanTitle}
                    </div>
                  </div>
                  <div className="z-10 space-y-2 uppercase font-serif text-[10px] sm:text-xs my-4 sm:my-8 text-center">
                    <span>BY</span><br /><br />
                    <span className="font-bold underline">CONFIDENTIAL STUDENT</span><br />
                    <span className="text-[9px] sm:text-[10px] text-zinc-500 font-mono">(MATRIC NO: RW/2022/NIG-042)</span>
                  </div>
                  <div className="z-10 text-[9px] sm:text-[10px] md:text-xs leading-relaxed max-w-md mx-auto font-serif text-zinc-600 text-center">
                    <p>
                      A RESEARCH PROJECT SUBMITTED TO THE DEPARTMENT OF {preview.department.toUpperCase()}, 
                      FACULTY OF {getFaculty(preview.department).toUpperCase()}, IN PARTIAL FULFILLMENT OF THE REQUIREMENTS 
                      FOR THE AWARD OF THE DEGREE OF {preview.level === 'PhD' ? 'DOCTOR OF PHILOSOPHY (Ph.D)' : preview.level === 'MSc' ? 'MASTER OF SCIENCE (M.Sc)' : 'BACHELOR OF SCIENCE (B.Sc)'} IN {preview.department.toUpperCase()}.
                    </p>
                  </div>
                  <div className="z-10 text-[9px] sm:text-[10px] font-sans text-zinc-400 uppercase tracking-widest border-t border-zinc-100 pt-3 sm:pt-4 w-full text-center">
                    YEAR: {preview.year || new Date().getFullYear()}
                    <div className="text-[8px] sm:text-[9px] text-emerald-600 font-bold mt-1">NIGERIAN UNIVERSITY ACADEMIC DEPOSIT SYSTEM</div>
                  </div>
                </A4Page>

                {/* Page 2: Certification — LOCKED */}
                <A4Page pageNum={2} locked className="overflow-hidden">
                  <div className="font-serif space-y-4 sm:space-y-6 text-[10px] sm:text-xs text-justify blur-[6px] select-none pointer-events-none opacity-40">
                    <h3 className="text-center font-bold text-[11px] sm:text-sm uppercase underline tracking-wider">CERTIFICATION / APPROVAL</h3>
                    <p style={{ textIndent: '2rem' }} className="leading-relaxed">
                      This is to certify that this research project titled <span className="font-bold">"{cleanTitle}"</span> was carried out by <span className="underline">CONFIDENTIAL STUDENT</span> with Matriculation Number <span className="font-mono">RW/2022/NIG-042</span> under our direct supervision in the Department of {preview.department}, Faculty of {getFaculty(preview.department)}.
                    </p>
                    <p className="leading-relaxed">
                      The study has been examined and approved as meeting the requirements for partial fulfillment of the award of the degree of {preview.level === 'PhD' ? 'Doctor of Philosophy (Ph.D)' : preview.level === 'MSc' ? 'Master of Science (M.Sc)' : 'Bachelor of Science (B.Sc)'} in {preview.department}.
                    </p>
                    <div className="pt-8 sm:pt-20 space-y-8 sm:space-y-12">
                      <div className="flex justify-between items-end gap-4">
                        <div className="border-t border-zinc-400 w-32 sm:w-56 text-center pt-2">
                          <p className="font-bold text-[9px] sm:text-xs">Supervisor</p>
                          <p className="text-[8px] sm:text-[10px] text-zinc-500">Date: __________</p>
                        </div>
                        <div className="border-t border-zinc-400 w-32 sm:w-56 text-center pt-2">
                          <p className="font-bold text-[9px] sm:text-xs">HOD</p>
                          <p className="text-[8px] sm:text-[10px] text-zinc-500">Date: __________</p>
                        </div>
                      </div>
                      <div className="flex justify-center">
                        <div className="border-t border-zinc-400 w-32 sm:w-56 text-center pt-2">
                          <p className="font-bold text-[9px] sm:text-xs">External Examiner</p>
                          <p className="text-[8px] sm:text-[10px] text-zinc-500">Date: __________</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <LockOverlay label="Certification is Locked" cta="Unlock All 50 Pages" />
                </A4Page>

                {/* Page 3: Dedication — LOCKED */}
                <A4Page pageNum={3} locked className="overflow-hidden">
                  <div className="font-serif space-y-6 sm:space-y-8 text-[10px] sm:text-xs text-center py-8 sm:py-20 blur-[6px] select-none pointer-events-none opacity-40">
                    <h3 className="font-bold text-[11px] sm:text-sm uppercase underline tracking-wider">DEDICATION</h3>
                    <p className="italic leading-loose max-w-md mx-auto">
                      "This research work is dedicated to Almighty God for His infinite grace, wisdom, protection and strength throughout the period of this study."
                    </p>
                    <p className="italic leading-loose max-w-md mx-auto">
                      "It is also dedicated to my beloved parents, for their relentless financial sacrifices, spiritual prayers, and moral guideposts which laid the foundational pillar of my educational achievements."
                    </p>
                  </div>
                  <LockOverlay label="Dedication is Locked" />
                </A4Page>

                {/* Page 4: Acknowledgements — LOCKED */}
                <A4Page pageNum={4} locked className="overflow-hidden">
                  <div className="font-serif space-y-4 sm:space-y-6 text-[10px] sm:text-xs text-justify blur-[6px] select-none pointer-events-none opacity-40">
                    <h3 className="text-center font-bold text-[11px] sm:text-sm uppercase underline tracking-wider">ACKNOWLEDGEMENTS</h3>
                    <p style={{ textIndent: '2rem' }} className="leading-relaxed">
                      I wish to express my deepest and sincere appreciation to my project supervisor, for devoting their precious time to review, criticize, and guide this research from conceptualization to completion. Their intellectual mentoring will always be cherished.
                    </p>
                    <p style={{ textIndent: '2rem' }} className="leading-relaxed">
                      My gratitude also goes to the Head of Department and all academic lecturers in the Department of {preview.department} for their qualitative lecturing and academic insights throughout my study period.
                    </p>
                    <p style={{ textIndent: '2rem' }} className="leading-relaxed">
                      Finally, I am eternally grateful to my parents and siblings for their unwavering confidence, prayers, financial sponsorships, and emotional support which made this dream a reality. May God bless you all.
                    </p>
                  </div>
                  <LockOverlay label="Acknowledgements is Locked" />
                </A4Page>

                {/* Page 5: Abstract — LOCKED */}
                <A4Page pageNum={5} locked className="overflow-hidden">
                  <div className="font-serif space-y-4 sm:space-y-6 text-[10px] sm:text-xs text-justify blur-[6px] select-none pointer-events-none opacity-40">
                    <h3 className="text-center font-bold text-[11px] sm:text-sm uppercase underline tracking-wider">ABSTRACT</h3>
                    <p style={{ textIndent: '2rem' }} className="leading-loose font-serif">
                      {previewData.abstract}
                    </p>
                    <p className="font-bold mt-4 font-serif">
                      Keywords: <span className="font-normal italic">{preview.department}, Nigerian Development, {previewData.varA}, {previewData.varB}, {preview.level} Research.</span>
                    </p>
                  </div>
                  <LockOverlay label="Abstract is Locked" cta="Unlock Abstract & All 50 Pages" />
                </A4Page>

                {/* Page 6: Table of Contents — LOCKED */}
                <A4Page pageNum={6} locked className="overflow-hidden">
                  <div className="font-serif space-y-3 sm:space-y-4 text-[10px] sm:text-xs blur-[6px] select-none pointer-events-none opacity-40">
                    <h3 className="text-center font-bold text-[11px] sm:text-sm uppercase underline tracking-wider mb-3 sm:mb-4">TABLE OF CONTENTS</h3>
                    <div className="space-y-1">
                      <div className="flex justify-between font-bold"><span>Title Page</span><span>i</span></div>
                      <div className="flex justify-between font-bold"><span>Certification</span><span>ii</span></div>
                      <div className="flex justify-between font-bold"><span>Dedication</span><span>iii</span></div>
                      <div className="flex justify-between font-bold"><span>Acknowledgements</span><span>iv</span></div>
                      <div className="flex justify-between font-bold"><span>Abstract</span><span>v</span></div>
                      <div className="flex justify-between font-bold"><span>Table of Contents</span><span>vi</span></div>
                      <div className="flex justify-between font-bold mt-2 text-emerald-700"><span>CHAPTER ONE: INTRODUCTION</span><span>1</span></div>
                      <div className="flex justify-between pl-4 text-zinc-600"><span>1.1 Background of the Study</span><span>1</span></div>
                      <div className="flex justify-between pl-4 text-zinc-600"><span>1.2 Statement of the Problem</span><span>4</span></div>
                      <div className="flex justify-between pl-4 text-zinc-600"><span>1.3 Objectives of the Study</span><span>5</span></div>
                      <div className="flex justify-between font-bold mt-2 text-zinc-400"><span>CHAPTER TWO: LITERATURE REVIEW</span><span>12</span></div>
                      <div className="flex justify-between font-bold mt-1 text-zinc-400"><span>CHAPTER THREE: METHODOLOGY</span><span>35</span></div>
                      <div className="flex justify-between font-bold mt-1 text-zinc-400"><span>CHAPTER FOUR: DATA ANALYSIS</span><span>42</span></div>
                      <div className="flex justify-between font-bold mt-1 text-zinc-400"><span>CHAPTER FIVE: CONCLUSION</span><span>48</span></div>
                    </div>
                  </div>
                  <LockOverlay label="Table of Contents is Locked" />
                </A4Page>

                {/* Page 7: Chapter One Part 1 — LOCKED */}
                <A4Page pageNum={7} locked className="overflow-hidden">
                  <div className="font-serif space-y-4 sm:space-y-6 text-[10px] sm:text-xs text-justify blur-[6px] select-none pointer-events-none opacity-40">
                    <div className="text-center font-bold text-zinc-900 leading-snug">
                      <h3>CHAPTER ONE</h3>
                      <h3>INTRODUCTION</h3>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-bold text-zinc-900">1.1 Background of the Study</h4>
                      <p style={{ textIndent: '2rem' }} className="leading-loose">{previewData.background}</p>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-bold text-zinc-900">1.2 Statement of the Problem</h4>
                      <p style={{ textIndent: '2rem' }} className="leading-loose">{previewData.problem}</p>
                    </div>
                  </div>
                  <LockOverlay label="Chapter One is Locked" cta="Unlock All Chapters (50 Pages)" />
                </A4Page>

                {/* Page 8: Chapter One Part 2 — LOCKED */}
                <A4Page pageNum={8} locked className="overflow-hidden">
                  <div className="font-serif space-y-4 sm:space-y-6 text-[10px] sm:text-xs text-justify blur-[6px] select-none pointer-events-none opacity-40">
                    <div className="space-y-2">
                      <h4 className="font-bold text-zinc-900">1.3 Objectives of the Study</h4>
                      <p>The main objective of this study is to examine the implications and impact of {cleanTitle} in Nigeria.</p>
                      <ul className="list-decimal pl-6 space-y-1 leading-relaxed">
                        <li>Assess the current level of implementation and awareness of {previewData.varA} in {previewData.caseStudy}.</li>
                        <li>Evaluate the main socio-economic challenges hindering optimal performance.</li>
                        <li>Determine the statistical relationship between {previewData.varA} and {previewData.varB}.</li>
                        <li>Offer strategic recommendations to policy makers.</li>
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-bold text-zinc-900">1.4 Research Questions</h4>
                      <ul className="list-disc pl-6 space-y-1 leading-relaxed">
                        <li>What is the current level of {previewData.varA} in {previewData.caseStudy}?</li>
                        <li>What are the primary challenges affecting {previewData.varA}?</li>
                        <li>Is there a significant relationship between {previewData.varA} and {previewData.varB}?</li>
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-bold text-zinc-900">1.5 Research Hypotheses</h4>
                      <p className="italic">Hypothesis One:</p>
                      <p className="pl-4 leading-relaxed"><strong>H0:</strong> No significant relationship between {previewData.varA} and {previewData.varB}.</p>
                      <p className="pl-4 leading-relaxed"><strong>H1:</strong> Significant relationship between {previewData.varA} and {previewData.varB}.</p>
                    </div>
                  </div>
                  <LockOverlay label="Page 8 of 50 is Locked" />
                </A4Page>

                {/* Pages 9-50: All remaining pages — LOCKED with generated text */}
                {Array.from({ length: 42 }, (_, idx) => {
                  const pageNum = idx + 9;
                  return (
                    <A4Page key={pageNum} pageNum={pageNum} locked className="overflow-hidden">
                      <div className="font-serif space-y-4 sm:space-y-6 text-[10px] sm:text-xs text-justify blur-[6px] select-none pointer-events-none opacity-20">
                        <div className="flex justify-between items-center text-[8px] sm:text-[9px] text-zinc-400 border-b pb-1 mb-3 sm:mb-4 font-sans">
                          <span>CHAPTER {pageNum < 20 ? 'ONE: INTRODUCTION' : pageNum < 30 ? 'TWO: LITERATURE REVIEW' : pageNum < 40 ? 'THREE: METHODOLOGY' : pageNum < 47 ? 'FOUR: DATA ANALYSIS' : 'FIVE: CONCLUSION'}</span>
                          <span>Page {pageNum}</span>
                        </div>
                        <p style={{ textIndent: '2rem' }} className="leading-loose">
                          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut feugiat lectus id interdum aliquet. Proin vitae felis nec libero ultrices tempor. Mauris feugiat dictum nibh.
                        </p>
                        <p style={{ textIndent: '2rem' }} className="leading-loose">
                          In the context of the Nigerian educational space, variables associated with {previewData.varA} have shown a direct correlation with {previewData.varB}. Regression modeling outputs show significant positive indicators.
                        </p>
                        <p style={{ textIndent: '2rem' }} className="leading-loose">
                          The standard evaluation mechanisms for {previewData.caseStudy} require absolute optimization to support sustainable practices across the entire operational framework.
                        </p>
                      </div>
                      {/* Full CTA every 10th page; a quiet badge on the rest. */}
                      {pageNum % 10 === 0
                        ? <LockOverlay label={`Page ${pageNum} of 50 is Locked`} cta="Unlock All 50 Pages" />
                        : <SubtleLock label={`Page ${pageNum} of 50 — Locked`} />}
                    </A4Page>
                  );
                })}
              </div>

              {/* Footer — responsive */}
              <div className="p-2.5 sm:p-4 border-t border-theme/50 flex flex-col sm:flex-row justify-between items-center gap-2 sm:gap-4 bg-secondary/20">
                <div className="text-center sm:text-left">
                  <span className="block text-[9px] sm:text-[11px] font-bold text-secondary uppercase">Project Scope</span>
                  <span className="text-[10px] sm:text-xs text-primary font-bold">{preview.pages || 50} pages • Chapters 1-5 (Word & PDF)</span>
                </div>
                <button 
                  onClick={() => {
                    setPreview(null);
                    openCart({
                      topicId: preview.id,
                      department: preview.department,
                      level: preview.level,
                      title: preview.title,
                      basePrice: getTopicPrice(preview.level, preview.department || 'General', Number(preview.price))
                    });
                  }} 
                  className="bg-emerald-500 hover:bg-emerald-400 text-black px-4 sm:px-6 py-2 sm:py-3 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition flex items-center gap-2 w-full sm:w-auto justify-center"
                >
                  💳 Get Material — {naira(getTopicPrice(preview.level, preview.department || 'General', Number(preview.price)))}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* CHECKOUT MODAL (add-ons + terms) */}
      {cart && (
        <div className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center p-4" onClick={() => !busy && setCart(null)}>
          <div className="bg-card border border-theme rounded-2xl max-w-lg w-full max-h-[88vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-start">
                <h2 className="text-lg font-black text-primary">Complete Your Purchase</h2>
                <button onClick={() => setCart(null)} className="text-secondary hover:text-primary"><lucide.X className="w-5 h-5" /></button>
              </div>
              <div className="bg-secondary border border-theme rounded-xl p-4">
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${levelBadgeClass(cart.level)}`}>{cart.level}</span>
                <p className="text-sm font-bold text-primary mt-2">{cart.title}</p>
                <p className="text-[11px] text-secondary">Chapters 1–5 · MS Word · {naira(cart.basePrice)}</p>
                <p className="text-[11px] font-bold text-amber-500 mt-1">{pageSettings.delivery_text}</p>
              </div>

              {/* Writer Assignment Simulation Panel */}
              <div className="bg-secondary/40 border border-theme rounded-2xl p-4 space-y-3 relative overflow-hidden">
                {simulationState === 'searching' && (
                  <div className="flex items-center gap-3 py-1">
                    <div className="w-4 h-4 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin shrink-0" />
                    <span className="text-secondary text-xs font-bold">Searching for available writers for your work...</span>
                  </div>
                )}
                {simulationState === 'bidding' && (
                  <div className="space-y-1 animate-in fade-in duration-300">
                    <div className="flex items-center gap-2 text-emerald-400 text-xs font-black">
                      <lucide.Users className="w-4 h-4" />
                      <span>Writer Search Complete</span>
                    </div>
                    <p className="text-secondary text-xs leading-relaxed font-semibold">
                      <strong className="text-primary font-black">{availableWriters}</strong> writers are available, and <strong className="text-primary font-black">{biddingWriters}</strong> are actively bidding to write your work.
                    </p>
                  </div>
                )}
                {simulationState === 'awarding' && (
                  <div className="flex items-center gap-3 py-1">
                    <div className="w-4 h-4 border-2 border-purple-500/20 border-t-purple-500 rounded-full animate-spin shrink-0" />
                    <span className="text-secondary text-xs font-bold">We are choosing the best writer for the job...</span>
                  </div>
                )}
                {simulationState === 'complete' && (
                  <div className="space-y-1.5 border-l-4 border-emerald-500 pl-3 animate-in slide-in-from-left duration-300">
                    <div className="flex items-center gap-2 text-emerald-400 text-[10px] font-black uppercase tracking-wider">
                      <lucide.CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>Writer Standby Secured</span>
                    </div>
                    <p className="text-primary text-xs font-bold">
                      Assigned Writer: <span className="underline decoration-emerald-500 decoration-2">{assignedWriter}</span>
                    </p>
                    <p className="text-[11px] text-secondary leading-relaxed font-semibold">
                      This writer is on standby to write your work for the next 6 hours. Proceed to pay to lock in this writer.
                    </p>
                  </div>
                )}
              </div>

              {isLoggedIn === false && (
                <div>
                  <label className="text-[10px] uppercase font-black text-secondary ml-1 block mb-1">Your Email (for receipt & vault access)</label>
                  <input
                    type="email"
                    value={guestEmail}
                    onChange={e => setGuestEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-secondary border border-theme rounded-xl px-3 py-2.5 text-sm text-primary outline-none focus:border-emerald-500"
                  />
                  <p className="text-[10px] text-secondary mt-1 font-semibold">An account will be created automatically using your email as your temporary password. You can change this later from your Profile.</p>
                </div>
              )}

              {addons.length > 0 && (
                <div>
                  <p className="text-[11px] uppercase font-black text-secondary mb-2">Optional Add-ons</p>
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                    {addons
                      .filter(a => [13, 14, 5, 10].includes(Number(a.id)))
                      .map(a => {
                        const on = selectedAddons.has(a.id);
                        return (
                          <div key={a.id} className={`p-3 rounded-xl border transition space-y-2 ${on ? 'border-emerald-500 bg-emerald-500/5' : 'border-theme bg-secondary'}`}>
                            <button onClick={() => setSelectedAddons(s => { const n = new Set(s); n.has(a.id) ? n.delete(a.id) : n.add(a.id); return n; })} className="w-full text-left flex items-start gap-3">
                              <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${on ? 'bg-emerald-500 border-emerald-500' : 'border-theme'}`}>{on && <lucide.Check className="w-3 h-3 text-black" />}</div>
                              <div className="flex-1">
                                <div className="flex justify-between gap-2">
                                  <span className="text-sm font-bold text-primary">{a.name}</span>
                                  <span className="text-xs font-black text-emerald-500 shrink-0">
                                    {a.price_type === 'per_word' ? `₦${a.price}/word` : `+${naira(a.price)}`}
                                  </span>
                                </div>
                                {a.description && <p className="text-[11px] text-secondary">{a.description}</p>}
                              </div>
                            </button>

                            {on && (
                              <div className="pl-7 space-y-2 border-t border-theme/20 pt-2 text-xs">
                                {/* If pricing type is per word */}
                                {a.price_type === 'per_word' && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-secondary text-[11px]">Word count:</span>
                                    <input
                                      type="number"
                                      min={500}
                                      step={100}
                                      value={addonWords[a.id] || 1000}
                                      onChange={e => {
                                        const w = Math.max(100, Number(e.target.value) || 0);
                                        setAddonWords(prev => ({ ...prev, [a.id]: w }));
                                      }}
                                      className="w-24 bg-card border border-theme rounded-md px-2 py-1 text-primary outline-none focus:border-emerald-500 font-mono text-center"
                                    />
                                    <span className="text-emerald-500 font-bold ml-1">
                                      ➔ {naira((addonWords[a.id] || 1000) * a.price)}
                                    </span>
                                  </div>
                                )}

                                {/* If location changer is active */}
                                {a.is_location_changer && (
                                  <div className="space-y-1">
                                    <span className="text-secondary text-[11px] block">Target Location / Case Study:</span>
                                    <input
                                      type="text"
                                      value={customLocation}
                                      onChange={e => setCustomLocation(e.target.value)}
                                      placeholder="e.g. Enugu State, University of Ibadan"
                                      className="w-full bg-card border border-theme rounded-md px-2 py-1 text-primary outline-none focus:border-emerald-500"
                                    />
                                  </div>
                                )}

                                {/* If it has sub-features */}
                                {Array.isArray(a.features) && a.features.length > 0 && (
                                  <div className="space-y-1">
                                    <span className="text-secondary text-[10px] font-black uppercase tracking-wider block mb-1">Includes Features:</span>
                                    <div className="grid grid-cols-1 gap-1">
                                      {a.features.map((f, fi) => {
                                        const selected = (addonFeatures[a.id] || []).includes(f.name);
                                        return (
                                          <label key={`${a.id}-${fi}`} className="flex items-center gap-2 cursor-pointer py-0.5">
                                            <input
                                              type="checkbox"
                                              checked={selected}
                                              onChange={e => {
                                                const current = addonFeatures[a.id] || [];
                                                const next = e.target.checked
                                                  ? [...current, f.name]
                                                  : current.filter(x => x !== f.name);
                                                setAddonFeatures(prev => ({ ...prev, [a.id]: next }));
                                              }}
                                              className="w-3.5 h-3.5 accent-emerald-500 shrink-0"
                                            />
                                            <span className="text-secondary text-[11px] flex-1">{f.name}</span>
                                            <span className="text-secondary font-bold text-[11px] shrink-0">+{naira(f.price)}</span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center border-t border-theme pt-3">
                <span className="text-sm font-bold text-secondary">Total</span>
                <span className="text-2xl font-black text-emerald-500">{naira(cartTotal())}</span>
              </div>

              <label className="flex items-start gap-2 cursor-pointer bg-secondary border border-theme rounded-xl p-3">
                <input type="checkbox" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} className="mt-0.5 w-4 h-4 accent-emerald-500 shrink-0" />
                <span className="text-[11px] text-primary leading-relaxed">
                  {pageSettings.checkout_terms}
                  <strong className="block mt-1.5 text-emerald-500 font-bold">
                    * AI-free and plagiarism-free revisions are only performed if you select the respective "No AI" or "No Plagiarism" add-ons above.
                  </strong>
                </span>
              </label>

              {msg && <div className="text-xs font-bold text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl p-3">{msg}</div>}

              <button 
                onClick={pay} 
                disabled={simulationState !== 'complete' || !acceptedTerms || busy || (isLoggedIn === false && !EMAIL_RE.test(guestEmail.trim()))} 
                className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-emerald-950 font-black transition disabled:opacity-40 disabled:cursor-not-allowed uppercase tracking-wider text-xs"
              >
                {simulationState !== 'complete' 
                  ? 'Writer Allocation in Progress...' 
                  : busy 
                    ? 'Redirecting to payment…' 
                    : `Pay ${naira(cartTotal())} & Get Material`}
              </button>
              <p className="text-[10px] text-secondary text-center">Payment is required before your order is created — unpaid attempts are never saved.</p>
            </div>
          </div>
        </div>
      )}

      <footer className="border-t border-theme py-8 text-center text-xs text-secondary">
        <p>© {new Date().getFullYear()} YourResearchWriter · Working hours 8am–7pm · <Link href="/" className="text-emerald-500 hover:underline">Home</Link></p>
      </footer>

      <ProjectsAssistant />
    </div>
  );
}
