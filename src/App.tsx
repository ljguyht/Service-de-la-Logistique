import React, { useState, useEffect, Component, ReactNode } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  LayoutDashboard, 
  Package, 
  Plus, 
  Search, 
  Filter, 
  LogOut, 
  Shield, 
  ChevronRight,
  BarChart3,
  MapPin,
  AlertCircle,
  CheckCircle2,
  Settings,
  Menu,
  X,
  Edit2,
  User as UserIcon,
  Truck,
  ArrowRightLeft,
  Calendar,
  Download,
  History,
  FileText,
  Table,
  Trash2,
  Users,
  Zap,
  HardHat,
  Wrench,
  Radio,
  Cross,
  Briefcase,
  Home,
  Activity,
  Cpu,
  FlaskConical,
  Gauge,
  Hammer,
  Key,
  LifeBuoy,
  Lightbulb,
  Lock,
  Plane,
  Plug,
  Power,
  Rocket,
  Server,
  Target,
  Thermometer,
  Wifi,
  Box,
  Construction,
  Stethoscope,
  Car,
  PlaneTakeoff,
  Anchor,
  Brain,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Info
} from 'lucide-react';
import { 
  doc, 
  updateDoc, 
  addDoc, 
  setDoc,
  deleteDoc,
  onSnapshot, 
  collection,
  query,
  where,
  getDocs,
  getDocFromServer
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import { db, auth } from './firebase';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Types
interface InventoryItem {
  id?: string;
  name: string;
  category: string;
  organization: 'Ministère de la Défense' | 'Forces Armées d\'Haïti' | 'Conjoint (Ministère & FAd\'H)';
  service?: string;
  direction?: string;
  deptDirection?: string;
  section?: string;
  militaryUnitId?: string;
  quantity: number;
  minThreshold: number;
  condition: string;
  location: string;
  serialNumber?: string;
  lastInventoryDate?: string;
  acquiredDate?: string;
  estimatedValue?: number;
  description?: string;
  notes?: string;
  icon?: string;
  munitions?: {
    type: string;
    quantity: number;
  };
}

interface Movement {
  id?: string;
  itemId: string;
  itemName: string;
  itemType: 'Matériel' | 'Mobilier';
  quantity: number;
  originUnit: string;
  destinationUnit: string;
  departureDate: string;
  arrivalDate?: string;
  status: 'En transit' | 'Livré' | 'Annulé';
  createdBy: string;
}

interface MilitaryUnit {
  id?: string;
  name: string;
  branch: "Armée de Terre" | "Corps d'Aviation" | "Garde-Côtes" | "Génie Militaire" | "Service de Santé" | "Autre";
  location?: string;
  commander?: string;
  personnelCount?: number;
  description?: string;
}

interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  role: 'Administrateur' | 'Officier Logistique' | 'Consultant';
  organization: 'Ministère de la Défense' | 'Forces Armées d\'Haïti' | 'Conjoint (Ministère & FAd\'H)';
}

interface PreAuthorizedUser {
  id?: string;
  email: string;
  role: 'Administrateur' | 'Officier Logistique' | 'Consultant';
  organization: 'Ministère de la Défense' | 'Forces Armées d\'Haïti' | 'Conjoint (Ministère & FAd\'H)';
  addedBy?: string;
  createdAt?: string;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Une erreur est survenue.";
      try {
        const parsed = JSON.parse(this.state.error?.message || "");
        if (parsed.error && parsed.error.includes("insufficient permissions")) {
          errorMessage = "Erreur de permissions Firestore. Veuillez contacter l'administrateur.";
        }
      } catch (e) {
        // Not a JSON error
      }
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-2xl shadow-xl border border-red-100 text-center max-w-md">
            <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">Oups !</h2>
            <p className="text-slate-600 mb-6">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-slate-900 text-white px-6 py-2 rounded-xl font-bold"
            >
              Recharger la page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const SUGGESTED_CATEGORIES = [
  "Armement & Munitions",
  "Véhicules & Transport",
  "Équipement Tactique",
  "Communications & Électronique",
  "Médical & Santé",
  "Subsistance (Nourriture/Eau)",
  "Carburant & Lubrifiants",
  "Matériaux de Construction",
  "Fournitures de Bureau",
  "Habillement & Protection",
  "Mobilier",
  "Informatique",
  "Outillage",
  "Autre"
];

const AVAILABLE_ICONS = [
  { name: 'Package', icon: Package },
  { name: 'Shield', icon: Shield },
  { name: 'Truck', icon: Truck },
  { name: 'Zap', icon: Zap },
  { name: 'HardHat', icon: HardHat },
  { name: 'Wrench', icon: Wrench },
  { name: 'Radio', icon: Radio },
  { name: 'Cross', icon: Cross },
  { name: 'Briefcase', icon: Briefcase },
  { name: 'Home', icon: Home },
  { name: 'Activity', icon: Activity },
  { name: 'Cpu', icon: Cpu },
  { name: 'FlaskConical', icon: FlaskConical },
  { name: 'Gauge', icon: Gauge },
  { name: 'Hammer', icon: Hammer },
  { name: 'Key', icon: Key },
  { name: 'LifeBuoy', icon: LifeBuoy },
  { name: 'Lightbulb', icon: Lightbulb },
  { name: 'Lock', icon: Lock },
  { name: 'Plane', icon: Plane },
  { name: 'Plug', icon: Plug },
  { name: 'Power', icon: Power },
  { name: 'Rocket', icon: Rocket },
  { name: 'Server', icon: Server },
  { name: 'Target', icon: Target },
  { name: 'Thermometer', icon: Thermometer },
  { name: 'Wifi', icon: Wifi },
  { name: 'Box', icon: Box },
  { name: 'Construction', icon: Construction },
  { name: 'Stethoscope', icon: Stethoscope },
  { name: 'Car', icon: Car },
  { name: 'PlaneTakeoff', icon: PlaneTakeoff },
  { name: 'Anchor', icon: Anchor }
];

const IconRenderer = ({ name, className }: { name?: string, className?: string }) => {
  const iconObj = AVAILABLE_ICONS.find(i => i.name === name) || AVAILABLE_ICONS[0];
  const IconComponent = iconObj.icon;
  return <IconComponent className={className} />;
};

interface AIInsight {
  category: string;
  subUnit?: string;
  status: 'Critique' | 'Attention' | 'Optimal';
  observation: string;
  recommendation: string;
  prediction: string;
}

interface AIAnalysisResult {
  lastUpdated: string;
  insights: AIInsight[];
  globalSummary: string;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [preAuthorizedUsers, setPreAuthorizedUsers] = useState<PreAuthorizedUser[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [units, setUnits] = useState<MilitaryUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory' | 'movements' | 'reports' | 'units' | 'ai_analysis' | 'user_management'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOrg, setFilterOrg] = useState<string>('All');
  
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // User Management State
  const [isAddingPreAuth, setIsAddingPreAuth] = useState(false);
  const [newPreAuth, setNewPreAuth] = useState<Partial<PreAuthorizedUser>>({
    role: 'Officier Logistique',
    organization: 'Ministère de la Défense'
  });
  const [authError, setAuthError] = useState<string | null>(null);
  
  // Report Filters
  const [reportFilters, setReportFilters] = useState({
    category: 'All',
    unit: 'All',
    militaryUnitId: 'All',
    service: '',
    direction: '',
    deptDirection: '',
    section: '',
    status: 'All',
    dateFrom: '',
    dateTo: ''
  });

  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isAddingMovement, setIsAddingMovement] = useState(false);
  const [isAddingUnit, setIsAddingUnit] = useState(false);
  const [isEditingItem, setIsEditingItem] = useState(false);
  const [isEditingUnit, setIsEditingUnit] = useState(false);
  const [isViewingUnit, setIsViewingUnit] = useState(false);
  const [showCloseConfirmation, setShowCloseConfirmation] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editingUnit, setEditingUnit] = useState<MilitaryUnit | null>(null);
  const [viewingUnit, setViewingUnit] = useState<MilitaryUnit | null>(null);
  const [newItem, setNewItem] = useState<Partial<InventoryItem>>({
    organization: 'Ministère de la Défense',
    quantity: 1,
    minThreshold: 5,
    condition: 'Bon',
    icon: 'Package',
    munitions: { type: '', quantity: 0 }
  });
  const [newMovement, setNewMovement] = useState<Partial<Movement>>({
    status: 'En transit',
    departureDate: new Date().toISOString().split('T')[0]
  });
  const [newUnit, setNewUnit] = useState<Partial<MilitaryUnit>>({
    branch: 'Armée de Terre'
  });

  const handleCloseAddItem = () => {
    const isDirty = newItem.name || newItem.serialNumber || newItem.category || newItem.location || newItem.notes || (newItem.munitions?.type && newItem.munitions.type !== '');
    if (isDirty) {
      setShowCloseConfirmation(true);
    } else {
      setIsAddingItem(false);
    }
  };

  const confirmClose = () => {
    setShowCloseConfirmation(false);
    setIsAddingItem(false);
    // Reset newItem to initial state
    setNewItem({
      organization: 'Ministère de la Défense',
      quantity: 1,
      minThreshold: 5,
      condition: 'Bon',
      icon: 'Package',
      munitions: { type: '', quantity: 0 }
    });
  };

  // Auth Listener
  useEffect(() => {
    if (!auth || !db) return;
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setAuthError(null);
      
      if (u) {
        // Fetch user profile
        const userDoc = doc(db, 'users', u.uid);
        const unsubProfile = onSnapshot(userDoc, async (docSnap) => {
          if (docSnap.exists()) {
            setUserProfile(docSnap.data() as UserProfile);
          } else {
            // Profile doesn't exist, check pre-authorization
            const preAuthQuery = query(collection(db, 'pre_authorized_users'), where('email', '==', u.email));
            const preAuthSnap = await getDocs(preAuthQuery);
            
            if (!preAuthSnap.empty) {
              const preAuthData = preAuthSnap.docs[0].data() as PreAuthorizedUser;
              // Create profile
              const newProfile: UserProfile = {
                uid: u.uid,
                fullName: u.displayName || 'Utilisateur',
                email: u.email || '',
                role: preAuthData.role,
                organization: preAuthData.organization
              };
              await setDoc(doc(db, 'users', u.uid), newProfile);
              setUserProfile(newProfile);
            } else {
              // Not authorized
              setAuthError("Votre compte n'est pas autorisé à accéder à ce système. Veuillez contacter un administrateur.");
              // Optional: sign out
              // signOut(auth);
            }
          }
        });
        return () => unsubProfile();
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Connection Test
  useEffect(() => {
    if (!db) return;
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();
  }, []);

  // Data Listener
  useEffect(() => {
    if (!db || !user) return;
    
    const unsubItems = onSnapshot(collection(db, 'items'), (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as InventoryItem[]);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'items');
    });

    const unsubMovements = onSnapshot(collection(db, 'movements'), (snapshot) => {
      setMovements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Movement[]);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'movements');
    });

    const unsubUnits = onSnapshot(collection(db, 'units'), (snapshot) => {
      setUnits(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as MilitaryUnit[]);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'units');
    });

    const unsubPreAuth = onSnapshot(collection(db, 'pre_authorized_users'), (snapshot) => {
      setPreAuthorizedUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PreAuthorizedUser[]);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'pre_authorized_users');
    });

    return () => {
      unsubItems();
      unsubMovements();
      unsubUnits();
      unsubPreAuth();
    };
  }, [user]);

  const handleLogin = async () => {
    if (!auth) {
      alert("Firebase non configuré. Veuillez accepter les termes dans l'interface de configuration.");
      return;
    }
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  const handleLogout = () => auth && signOut(auth);

  const runAIAnalysis = async () => {
    if (!process.env.GEMINI_API_KEY) return;
    setIsAnalyzing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const inventorySummary = items.map(i => ({
        name: i.name,
        category: i.category,
        quantity: i.quantity,
        minThreshold: i.minThreshold,
        condition: i.condition,
        org: i.organization,
        militaryUnit: units.find(u => u.id === i.militaryUnitId)?.name || 'N/A',
        service: i.service || 'N/A',
        direction: i.direction || 'N/A',
        deptDirection: i.deptDirection || 'N/A',
        section: i.section || 'N/A'
      }));

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyse cet inventaire logistique militaire (MDH & FAd'H) et fournis des insights stratégiques en JSON.
        Prends en compte les sous-unités organisationnelles (Service, Direction, Direction Départementale, Section, Unité Militaire) pour corréler les niveaux de stock et les conditions avec ces entités spécifiques.
        Inventaire: ${JSON.stringify(inventorySummary)}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              globalSummary: { type: Type.STRING },
              insights: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    category: { type: Type.STRING },
                    subUnit: { type: Type.STRING, description: "La sous-unité organisationnelle concernée (Service, Direction, Section, etc.)" },
                    status: { type: Type.STRING, enum: ["Critique", "Attention", "Optimal"] },
                    observation: { type: Type.STRING },
                    recommendation: { type: Type.STRING },
                    prediction: { type: Type.STRING }
                  },
                  required: ["category", "status", "observation", "recommendation", "prediction"]
                }
              }
            },
            required: ["globalSummary", "insights"]
          }
        }
      });

      const result = JSON.parse(response.text);
      setAiAnalysis({
        ...result,
        lastUpdated: new Date().toLocaleString()
      });
    } catch (error) {
      console.error("AI Analysis error:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'ai_analysis' && !aiAnalysis && items.length > 0) {
      runAIAnalysis();
    }
  }, [activeTab, items.length]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user) return;
    try {
      await addDoc(collection(db, 'items'), {
        ...newItem,
        updatedBy: user.uid,
        lastInventoryDate: new Date().toISOString().split('T')[0]
      });
      setIsAddingItem(false);
      setNewItem({
        organization: 'Ministère de la Défense',
        quantity: 1,
        condition: 'Bon',
        munitions: { type: '', quantity: 0 }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'items');
    }
  };

  const handleAddMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user || !newMovement.itemId) return;
    try {
      await addDoc(collection(db, 'movements'), {
        ...newMovement,
        createdBy: user.uid
      });
      setIsAddingMovement(false);
      setNewMovement({ status: 'En transit', departureDate: new Date().toISOString().split('T')[0] });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'movements');
    }
  };

  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user || !editingItem || !editingItem.id) return;
    try {
      const itemRef = doc(db, 'items', editingItem.id);
      const { id, ...itemData } = editingItem;
      await updateDoc(itemRef, {
        ...itemData,
        updatedAt: new Date().toISOString()
      });
      setIsEditingItem(false);
      setEditingItem(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `items/${editingItem.id}`);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!db || !user) return;
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cet article ?")) return;
    try {
      await deleteDoc(doc(db, 'items', id));
      setIsEditingItem(false);
      setEditingItem(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `items/${id}`);
    }
  };

  const handleAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user) return;
    try {
      await addDoc(collection(db, 'units'), {
        ...newUnit
      });
      setIsAddingUnit(false);
      setNewUnit({ branch: 'Armée de Terre' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'units');
    }
  };

  const handleUpdateUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user || !editingUnit || !editingUnit.id) return;
    try {
      const unitRef = doc(db, 'units', editingUnit.id);
      const { id, ...unitData } = editingUnit;
      await updateDoc(unitRef, {
        ...unitData
      });
      setIsEditingUnit(false);
      setEditingUnit(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `units/${editingUnit.id}`);
    }
  };

  const handleDeleteUnit = async (id: string) => {
    if (!db || !user) return;
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cette unité ?")) return;
    try {
      await deleteDoc(doc(db, 'units', id));
      setIsEditingUnit(false);
      setEditingUnit(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `units/${id}`);
    }
  };

  const handleAddPreAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user || !newPreAuth.email) return;
    try {
      await addDoc(collection(db, 'pre_authorized_users'), {
        ...newPreAuth,
        addedBy: user.uid,
        createdAt: new Date().toISOString()
      });
      setIsAddingPreAuth(false);
      setNewPreAuth({ role: 'Officier Logistique', organization: 'Ministère de la Défense' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'pre_authorized_users');
    }
  };

  const handleDeletePreAuth = async (id: string) => {
    if (!db || !user) return;
    if (!window.confirm("Supprimer cette autorisation ?")) return;
    try {
      await deleteDoc(doc(db, 'pre_authorized_users', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `pre_authorized_users/${id}`);
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         item.serialNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesOrg = filterOrg === 'All' || item.organization === filterOrg;
    return matchesSearch && matchesOrg;
  });

  const exportToPDF = () => {
    const doc = new jsPDF();
    const tableColumn = ["Nom", "Organisation", "Catégorie", "S/N", "Quantité", "État", "Emplacement"];
    const tableRows = filteredItems.map(item => [
      item.name,
      item.organization,
      item.category || '-',
      item.serialNumber || '-',
      item.quantity,
      item.condition,
      item.location || '-'
    ]);

    doc.setFontSize(18);
    doc.text("Rapport d'Inventaire Logistique", 14, 22);
    doc.setFontSize(11);
    doc.text(`Généré le: ${new Date().toLocaleString()}`, 14, 30);
    doc.text(`Filtre Organisation: ${filterOrg === 'All' ? 'Toutes' : filterOrg}`, 14, 38);

    (doc as any).autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 45,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] }
    });

    doc.save(`rapport_inventaire_${new Date().getTime()}.pdf`);
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(filteredItems.map(item => ({
      "Nom": item.name,
      "Organisation": item.organization,
      "Catégorie": item.category,
      "Numéro de Série": item.serialNumber,
      "Quantité": item.quantity,
      "État": item.condition,
      "Emplacement": item.location,
      "Seuil Min": item.minThreshold,
      "Valeur Estimée": item.estimatedValue,
      "Date Acquisition": item.acquiredDate,
      "Dernier Inventaire": item.lastInventoryDate
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inventaire");
    XLSX.writeFile(workbook, `rapport_inventaire_${new Date().getTime()}.xlsx`);
  };

  const lowStockItems = items.filter(item => item.quantity <= (item.minThreshold || 0));

  const stats = {
    total: items.length,
    mdh: items.filter(i => i.organization === 'Ministère de la Défense').length,
    fadh: items.filter(i => i.organization === 'Forces Armées d\'Haïti').length,
    conjoint: items.filter(i => i.organization === 'Conjoint (Ministère & FAd\'H)').length,
    damaged: items.filter(i => i.condition === 'Endommagé' || i.condition === 'En réparation').length
  };

  const chartData = [
    { name: 'MDH', count: stats.mdh },
    { name: 'FAd\'H', count: stats.fadh },
    { name: 'Conjoint', count: stats.conjoint }
  ];

  const COLORS = ['#0f172a', '#b91c1c'];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white p-10 rounded-3xl shadow-2xl max-w-md w-full text-center space-y-8">
          <div className="bg-slate-100 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg rotate-3">
            <Shield className="text-slate-900 w-10 h-10" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Logistique MDH & FAd'H</h1>
          <p className="text-slate-500 mb-8">Système de gestion des matériels et mobiliers du Ministère de la Défense d'Haïti.</p>
          
          {authError && (
            <div className="bg-red-50 border border-red-200 p-4 rounded-2xl flex items-start gap-3 text-left mb-6">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm text-red-800 font-medium leading-relaxed">{authError}</p>
            </div>
          )}

          <button 
            onClick={handleLogin}
            className="w-full bg-slate-900 text-white py-4 rounded-xl font-semibold hover:bg-slate-800 transition-all flex items-center justify-center gap-3 active:scale-95 shadow-md"
          >
            <UserIcon className="w-5 h-5" />
            Se connecter avec Google
          </button>
          <p className="mt-6 text-xs text-slate-400 uppercase tracking-widest font-bold">République d'Haïti</p>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-10 rounded-3xl shadow-xl max-w-md w-full text-center space-y-6 border border-slate-200">
          <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8 text-red-600" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-900">Accès Refusé</h2>
            <p className="text-slate-500">{authError}</p>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full bg-slate-100 text-slate-900 py-3 rounded-xl font-bold hover:bg-slate-200 transition-all"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className={cn(
        "bg-slate-900 text-white transition-all duration-300 flex flex-col sticky top-0 h-screen",
        isSidebarOpen ? "w-72" : "w-20"
      )}>
        <div className="p-6 flex items-center gap-4 border-b border-slate-800">
          <div className="bg-white/10 p-2 rounded-lg">
            <Shield className="w-6 h-6 text-white" />
          </div>
          {isSidebarOpen && <span className="font-bold text-lg truncate">Logistique MDH</span>}
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <NavItem 
            icon={<LayoutDashboard />} 
            label="Tableau de Bord" 
            active={activeTab === 'dashboard'} 
            collapsed={!isSidebarOpen}
            onClick={() => setActiveTab('dashboard')}
          />
          <NavItem 
            icon={<Package />} 
            label="Inventaire" 
            active={activeTab === 'inventory'} 
            collapsed={!isSidebarOpen}
            onClick={() => setActiveTab('inventory')}
          />
          <NavItem 
            icon={<Truck />} 
            label="Mouvements" 
            active={activeTab === 'movements'} 
            collapsed={!isSidebarOpen}
            onClick={() => setActiveTab('movements')}
          />
          <NavItem 
            icon={<Users />} 
            label="Unités" 
            active={activeTab === 'units'} 
            collapsed={!isSidebarOpen}
            onClick={() => setActiveTab('units')}
          />
          <NavItem 
            icon={<BarChart3 />} 
            label="Rapports" 
            active={activeTab === 'reports'} 
            collapsed={!isSidebarOpen}
            onClick={() => setActiveTab('reports')}
          />
          <NavItem 
            icon={<Brain />} 
            label="Analyse IA" 
            active={activeTab === 'ai_analysis'} 
            collapsed={!isSidebarOpen}
            onClick={() => setActiveTab('ai_analysis')}
          />
          {userProfile?.role === 'Administrateur' && (
            <NavItem 
              icon={<Users />} 
              label="Utilisateurs" 
              active={activeTab === 'user_management'} 
              collapsed={!isSidebarOpen}
              onClick={() => setActiveTab('user_management')}
            />
          )}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors text-slate-400 hover:text-white"
          >
            <LogOut className="w-6 h-6" />
            {isSidebarOpen && <span className="font-medium">Déconnexion</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 h-20 flex items-center justify-between px-8 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-bold text-slate-900">
              {activeTab === 'dashboard' && 'Tableau de Bord'}
              {activeTab === 'inventory' && 'Gestion de l\'Inventaire'}
              {activeTab === 'movements' && 'Suivi des Mouvements'}
              {activeTab === 'reports' && 'Rapports Personnalisés'}
              {activeTab === 'ai_analysis' && 'Analyse Prédictive IA'}
              {activeTab === 'user_management' && 'Gestion des Utilisateurs'}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-slate-900">{userProfile?.fullName || user.displayName}</p>
              <p className="text-xs text-slate-500">{userProfile?.role || 'Utilisateur'}</p>
            </div>
            <img 
              src={user.photoURL || ''} 
              alt="Profile" 
              className="w-10 h-10 rounded-full border-2 border-slate-100"
              referrerPolicy="no-referrer"
            />
          </div>
        </header>

        <div className="p-8 overflow-y-auto">
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                <StatCard title="Total Articles" value={stats.total} icon={<Package className="text-blue-600" />} />
                <StatCard title="Ministère (MDH)" value={stats.mdh} icon={<Shield className="text-slate-900" />} />
                <StatCard title="Forces Armées (FAd'H)" value={stats.fadh} icon={<Shield className="text-red-600" />} />
                <StatCard title="Conjoint (MDH/FAd'H)" value={stats.conjoint} icon={<Shield className="text-indigo-600" />} />
                <StatCard title="Alertes Stock Bas" value={lowStockItems.length} icon={<AlertCircle className="text-red-600" />} trend={lowStockItems.length > 0 ? "Critique" : "Normal"} />
              </div>

              {lowStockItems.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <AlertCircle className="text-red-600 w-6 h-6" />
                    <h3 className="text-lg font-bold text-red-900">Alertes de Stock Bas</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {lowStockItems.map(item => (
                      <div key={item.id} className="bg-white p-4 rounded-xl border border-red-100 shadow-sm flex justify-between items-center">
                        <div>
                          <p className="font-bold text-slate-900">{item.name}</p>
                          <p className="text-xs text-slate-500">{item.organization}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-red-600">{item.quantity}</p>
                          <p className="text-[10px] text-slate-400 uppercase">Seuil: {item.minThreshold}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="text-lg font-bold mb-6">Répartition par Organisation</h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="count" fill="#0f172a" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="text-lg font-bold mb-6">État du Matériel</h3>
                  <div className="h-80 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Bon', value: items.filter(i => i.condition === 'Bon' || i.condition === 'Neuf').length },
                            { name: 'Usagé', value: items.filter(i => i.condition === 'Usagé').length },
                            { name: 'Critique', value: stats.damaged }
                          ]}
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          <Cell fill="#10b981" />
                          <Cell fill="#f59e0b" />
                          <Cell fill="#ef4444" />
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'inventory' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <div className="relative w-full sm:w-96">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input 
                    type="text" 
                    placeholder="Rechercher un article ou numéro de série..."
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                
                <div className="flex gap-3 w-full sm:w-auto">
                  <select 
                    className="px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                    value={filterOrg}
                    onChange={(e) => setFilterOrg(e.target.value)}
                  >
                    <option value="All">Toutes les Organisations</option>
                    <option value="Ministère de la Défense">MDH</option>
                    <option value="Forces Armées d'Haïti">FAd'H</option>
                    <option value="Conjoint (Ministère & FAd'H)">Conjoint</option>
                  </select>
                  <button 
                    onClick={exportToPDF}
                    className="bg-white text-slate-700 px-4 py-3 rounded-xl font-bold flex items-center gap-2 border border-slate-200 hover:bg-slate-50 active:scale-95 transition-all shadow-sm"
                    title="Exporter en PDF"
                  >
                    <FileText className="w-5 h-5" />
                    <span className="hidden md:inline">PDF</span>
                  </button>
                  <button 
                    onClick={exportToExcel}
                    className="bg-white text-slate-700 px-4 py-3 rounded-xl font-bold flex items-center gap-2 border border-slate-200 hover:bg-slate-50 active:scale-95 transition-all shadow-sm"
                    title="Exporter en Excel"
                  >
                    <Table className="w-5 h-5" />
                    <span className="hidden md:inline">Excel</span>
                  </button>
                  <button 
                    onClick={() => setIsAddingItem(true)}
                    className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-800 active:scale-95 transition-all shadow-md"
                  >
                    <Plus className="w-5 h-5" />
                    Nouvel Article
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Article</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Organisation</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Catégorie</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Quantité</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">État</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Emplacement</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600">
                              <IconRenderer name={item.icon} className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-bold text-slate-900">{item.name}</p>
                              <p className="text-xs text-slate-500 font-mono">{item.serialNumber || 'S/N: N/A'}</p>
                              {item.munitions && item.munitions.type && (
                                <p className="text-[10px] text-blue-600 font-bold mt-1 bg-blue-50 px-1.5 py-0.5 rounded inline-block">
                                  Mun: {item.munitions.type} ({item.munitions.quantity})
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-3 py-1 rounded-full text-xs font-bold",
                            item.organization === 'Ministère de la Défense' ? "bg-slate-100 text-slate-700" : 
                            item.organization === 'Forces Armées d\'Haïti' ? "bg-red-50 text-red-700" :
                            "bg-indigo-50 text-indigo-700"
                          )}>
                            {item.organization === 'Ministère de la Défense' ? 'MDH' : 
                             item.organization === 'Forces Armées d\'Haïti' ? 'FAd\'H' : 'CONJOINT'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{item.category}</td>
                        <td className="px-6 py-4 font-mono font-bold">{item.quantity}</td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "flex items-center gap-1.5 text-sm font-medium",
                            item.condition === 'Neuf' || item.condition === 'Bon' ? "text-emerald-600" : 
                            item.condition === 'Usagé' ? "text-amber-600" : "text-red-600"
                          )}>
                            <div className={cn(
                              "w-2 h-2 rounded-full",
                              item.condition === 'Neuf' || item.condition === 'Bon' ? "bg-emerald-500" : 
                              item.condition === 'Usagé' ? "bg-amber-500" : "bg-red-500"
                            )} />
                            {item.condition}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {item.location}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <button 
                            onClick={() => {
                              setEditingItem(item);
                              setIsEditingItem(true);
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 hover:text-slate-900 transition-all text-xs font-bold"
                          >
                            <Settings className="w-4 h-4" />
                            Modifier
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredItems.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                          Aucun article trouvé.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'movements' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold">Historique des Mouvements</h3>
                <button 
                  onClick={() => setIsAddingMovement(true)}
                  className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2"
                >
                  <ArrowRightLeft className="w-5 h-5" />
                  Enregistrer un Mouvement
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Article</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Quantité</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Origine</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Destination</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Date Départ</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {movements.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-900">{m.itemName}</td>
                        <td className="px-6 py-4 font-mono">{m.quantity}</td>
                        <td className="px-6 py-4 text-sm">{m.originUnit}</td>
                        <td className="px-6 py-4 text-sm">{m.destinationUnit}</td>
                        <td className="px-6 py-4 text-sm">{m.departureDate}</td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-3 py-1 rounded-full text-xs font-bold",
                            m.status === 'Livré' ? "bg-emerald-100 text-emerald-700" : 
                            m.status === 'En transit' ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"
                          )}>
                            {m.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="space-y-8">
              <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <Filter className="w-5 h-5" />
                  Filtres de Rapport
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Catégorie</label>
                    <select 
                      className="w-full p-3 rounded-xl border border-slate-200 outline-none"
                      value={reportFilters.category}
                      onChange={e => setReportFilters({...reportFilters, category: e.target.value})}
                    >
                      <option value="All">Toutes</option>
                      <option value="Matériel">Matériel</option>
                      <option value="Mobilier">Mobilier</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Organisation</label>
                    <select 
                      className="w-full p-3 rounded-xl border border-slate-200 outline-none"
                      value={reportFilters.unit}
                      onChange={e => setReportFilters({...reportFilters, unit: e.target.value, militaryUnitId: 'All'})}
                    >
                      <option value="All">Toutes</option>
                      <option value="Ministère de la Défense">Ministère</option>
                      <option value="Forces Armées d'Haïti">FAd'H</option>
                      <option value="Conjoint (Ministère & FAd'H)">Conjoint</option>
                    </select>
                  </div>
                  {reportFilters.unit === "Forces Armées d'Haïti" && (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">Unité Militaire</label>
                      <select 
                        className="w-full p-3 rounded-xl border border-slate-200 outline-none"
                        value={reportFilters.militaryUnitId}
                        onChange={e => setReportFilters({...reportFilters, militaryUnitId: e.target.value})}
                      >
                        <option value="All">Toutes les unités</option>
                        {units.map(u => (
                          <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Service</label>
                    <input 
                      type="text" 
                      placeholder="Filtrer par service..."
                      className="w-full p-3 rounded-xl border border-slate-200 outline-none"
                      value={reportFilters.service}
                      onChange={e => setReportFilters({...reportFilters, service: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Direction</label>
                    <input 
                      type="text" 
                      placeholder="Filtrer par direction..."
                      className="w-full p-3 rounded-xl border border-slate-200 outline-none"
                      value={reportFilters.direction}
                      onChange={e => setReportFilters({...reportFilters, direction: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Dir. Départementale</label>
                    <input 
                      type="text" 
                      placeholder="Filtrer par dir. dép..."
                      className="w-full p-3 rounded-xl border border-slate-200 outline-none"
                      value={reportFilters.deptDirection}
                      onChange={e => setReportFilters({...reportFilters, deptDirection: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Section</label>
                    <input 
                      type="text" 
                      placeholder="Filtrer par section..."
                      className="w-full p-3 rounded-xl border border-slate-200 outline-none"
                      value={reportFilters.section}
                      onChange={e => setReportFilters({...reportFilters, section: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Statut</label>
                    <select 
                      className="w-full p-3 rounded-xl border border-slate-200 outline-none"
                      value={reportFilters.status}
                      onChange={e => setReportFilters({...reportFilters, status: e.target.value})}
                    >
                      <option value="All">Tous</option>
                      <option value="Bon">En stock (Bon)</option>
                      <option value="En réparation">En réparation</option>
                      <option value="Endommagé">Hors service</option>
                      <option value="Usagé">Usagé</option>
                      <option value="Neuf">Neuf</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Date de début</label>
                    <input 
                      type="date" 
                      className="w-full p-3 rounded-xl border border-slate-200 outline-none"
                      value={reportFilters.dateFrom}
                      onChange={e => setReportFilters({...reportFilters, dateFrom: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Date de fin</label>
                    <input 
                      type="date" 
                      className="w-full p-3 rounded-xl border border-slate-200 outline-none"
                      value={reportFilters.dateTo}
                      onChange={e => setReportFilters({...reportFilters, dateTo: e.target.value})}
                    />
                  </div>
                </div>
                <div className="mt-6 flex justify-end">
                  <button className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2">
                    <Download className="w-5 h-5" />
                    Exporter PDF / Excel
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Article</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Description</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Quantité</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Valeur Est.</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Date d'Acq.</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Localisation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items
                      .filter(i => {
                        const catMatch = reportFilters.category === 'All' || i.category === reportFilters.category;
                        const unitMatch = reportFilters.unit === 'All' || i.organization === reportFilters.unit;
                        const milUnitMatch = reportFilters.militaryUnitId === 'All' || i.militaryUnitId === reportFilters.militaryUnitId;
                        const serviceMatch = !reportFilters.service || i.service?.toLowerCase().includes(reportFilters.service.toLowerCase());
                        const directionMatch = !reportFilters.direction || i.direction?.toLowerCase().includes(reportFilters.direction.toLowerCase());
                        const deptDirMatch = !reportFilters.deptDirection || i.deptDirection?.toLowerCase().includes(reportFilters.deptDirection.toLowerCase());
                        const sectionMatch = !reportFilters.section || i.section?.toLowerCase().includes(reportFilters.section.toLowerCase());
                        const statusMatch = reportFilters.status === 'All' || i.condition === reportFilters.status;
                        const dateFromMatch = !reportFilters.dateFrom || (i.acquiredDate && i.acquiredDate >= reportFilters.dateFrom);
                        const dateToMatch = !reportFilters.dateTo || (i.acquiredDate && i.acquiredDate <= reportFilters.dateTo);
                        return catMatch && unitMatch && milUnitMatch && serviceMatch && directionMatch && deptDirMatch && sectionMatch && statusMatch && dateFromMatch && dateToMatch;
                      })
                      .map(item => (
                        <tr key={item.id} className="text-sm">
                          <td className="px-6 py-4 font-bold">{item.name}</td>
                          <td className="px-6 py-4 text-slate-500">{item.description || 'N/A'}</td>
                          <td className="px-6 py-4 font-mono">{item.quantity}</td>
                          <td className="px-6 py-4 font-mono text-emerald-600">${item.estimatedValue?.toLocaleString() || '0'}</td>
                          <td className="px-6 py-4 text-slate-500">{item.acquiredDate || 'N/A'}</td>
                          <td className="px-6 py-4">{item.location}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'ai_analysis' && (
            <div className="space-y-8">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-200">
                    <Brain className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900">Analyse Logistique IA</h3>
                    <p className="text-slate-500 text-sm">Insights prédictifs et optimisation des stocks en temps réel.</p>
                  </div>
                </div>
                <button 
                  onClick={runAIAnalysis}
                  disabled={isAnalyzing}
                  className={cn(
                    "px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-md",
                    isAnalyzing ? "bg-slate-100 text-slate-400" : "bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95"
                  )}
                >
                  {isAnalyzing ? (
                    <>
                      <Zap className="w-5 h-5 animate-pulse" />
                      Analyse en cours...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Relancer l'Analyse
                    </>
                  )}
                </button>
              </div>

              {!aiAnalysis && !isAnalyzing && (
                <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-4">
                  <div className="bg-indigo-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
                    <Brain className="w-10 h-10 text-indigo-600" />
                  </div>
                  <h4 className="text-xl font-bold text-slate-900">Prêt pour l'analyse</h4>
                  <p className="text-slate-500 max-w-md mx-auto">
                    L'IA va analyser vos stocks de nourriture, munitions, uniformes et matériels pour identifier les risques de rupture et optimiser les ressources.
                  </p>
                  <button 
                    onClick={runAIAnalysis}
                    className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all"
                  >
                    Démarrer l'Analyse
                  </button>
                </div>
              )}

              {isAnalyzing && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 animate-pulse space-y-4">
                      <div className="h-4 bg-slate-100 rounded w-1/2"></div>
                      <div className="h-20 bg-slate-50 rounded"></div>
                      <div className="h-4 bg-slate-100 rounded w-3/4"></div>
                    </div>
                  ))}
                </div>
              )}

              {aiAnalysis && !isAnalyzing && (
                <div className="space-y-8">
                  <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                      <Brain className="w-40 h-40" />
                    </div>
                    <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-4 text-indigo-400 font-bold uppercase tracking-widest text-xs">
                        <Info className="w-4 h-4" />
                        Résumé Stratégique Global
                      </div>
                      <p className="text-xl leading-relaxed font-medium">
                        {aiAnalysis.globalSummary}
                      </p>
                      <div className="mt-6 text-slate-400 text-xs">
                        Dernière mise à jour : {aiAnalysis.lastUpdated}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {aiAnalysis.insights.map((insight, idx) => (
                      <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h4 className="font-bold text-slate-900">{insight.category}</h4>
                            {insight.subUnit && (
                              <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mt-0.5">
                                {insight.subUnit}
                              </p>
                            )}
                          </div>
                          <span className={cn(
                            "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter",
                            insight.status === 'Critique' ? "bg-red-100 text-red-700" :
                            insight.status === 'Attention' ? "bg-amber-100 text-amber-700" :
                            "bg-emerald-100 text-emerald-700"
                          )}>
                            {insight.status}
                          </span>
                        </div>
                        
                        <div className="space-y-4 flex-1">
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Observation</p>
                            <p className="text-sm text-slate-700">{insight.observation}</p>
                          </div>
                          
                          <div>
                            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Recommandation</p>
                            <p className="text-sm text-slate-900 font-medium">{insight.recommendation}</p>
                          </div>

                          <div className="pt-4 border-t border-slate-100 flex items-center gap-2 text-indigo-600">
                            <TrendingUp className="w-4 h-4" />
                            <p className="text-xs font-bold italic">{insight.prediction}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'units' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold">Unités et Branches Militaires (FAd'H)</h3>
                <button 
                  onClick={() => setIsAddingUnit(true)}
                  className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-800 transition-all shadow-md"
                >
                  <Plus className="w-5 h-5" />
                  Nouvelle Unité
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {units.map((unit) => (
                  <div 
                    key={unit.id} 
                    className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group cursor-pointer relative"
                    onClick={() => {
                      setViewingUnit(unit);
                      setIsViewingUnit(true);
                    }}
                  >
                    {/* Tooltip */}
                    <div className="absolute bottom-[105%] left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-30 w-56 pointer-events-none">
                      <div className="bg-slate-900 text-white text-[11px] p-4 rounded-2xl shadow-2xl border border-slate-800 animate-in fade-in slide-in-from-bottom-2 duration-200">
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10">
                          <Info className="w-3 h-3 text-indigo-400" />
                          <span className="font-black uppercase tracking-widest">Détails de l'Unité</span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Commandant:</span>
                            <span className="font-bold text-indigo-300">{unit.commander || 'Non assigné'}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Effectif:</span>
                            <span className="font-bold text-emerald-400">{unit.personnelCount || 0} membres</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Localisation:</span>
                            <span className="font-bold">{unit.location || 'N/A'}</span>
                          </div>
                        </div>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900"></div>
                      </div>
                    </div>

                    <div className="flex justify-between items-start mb-4">
                      <div className="bg-slate-100 p-3 rounded-xl">
                        <Users className="w-6 h-6 text-slate-900" />
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={() => {
                            setEditingUnit(unit);
                            setIsEditingUnit(true);
                          }}
                          className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-900"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => unit.id && handleDeleteUnit(unit.id)}
                          className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <h4 className="text-lg font-bold text-slate-900 mb-1">{unit.name}</h4>
                    <span className="inline-block px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase rounded mb-4">
                      {unit.branch}
                    </span>
                    <div className="space-y-2 text-sm text-slate-600">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        <span>{unit.location || 'Non spécifié'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <UserIcon className="w-4 h-4 text-slate-400" />
                        <span>Cmd: {unit.commander || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-slate-400" />
                        <span>Personnel: {unit.personnelCount || 0}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'user_management' && userProfile?.role === 'Administrateur' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-900">Utilisateurs Pré-Autorisés</h3>
                <button 
                  onClick={() => setIsAddingPreAuth(true)}
                  className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg"
                >
                  <Plus className="w-5 h-5" />
                  Nouvelle Autorisation
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Rôle / Accréditation</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Organisation</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preAuthorizedUsers.map(auth => (
                      <tr key={auth.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                              <UserIcon className="w-4 h-4 text-slate-500" />
                            </div>
                            <span className="font-medium text-slate-900">{auth.email}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-3 py-1 rounded-full text-xs font-bold",
                            auth.role === 'Administrateur' ? "bg-red-100 text-red-700" :
                            auth.role === 'Officier Logistique' ? "bg-blue-100 text-blue-700" :
                            "bg-slate-100 text-slate-700"
                          )}>
                            {auth.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-600 text-sm">
                          {auth.organization}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => auth.id && handleDeletePreAuth(auth.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {preAuthorizedUsers.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                          Aucun utilisateur pré-autorisé.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Add Pre-Auth Modal */}
      {isAddingPreAuth && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold">Nouvelle Autorisation</h3>
              <button onClick={() => setIsAddingPreAuth(false)} className="p-2 hover:bg-slate-100 rounded-full">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleAddPreAuth} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Email de l'utilisateur</label>
                <input 
                  required
                  type="email" 
                  placeholder="exemple@email.com"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                  value={newPreAuth.email || ''}
                  onChange={e => setNewPreAuth({...newPreAuth, email: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Niveau d'Accréditation (Rôle)</label>
                <select 
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                  value={newPreAuth.role}
                  onChange={e => setNewPreAuth({...newPreAuth, role: e.target.value as any})}
                >
                  <option value="Administrateur">Administrateur</option>
                  <option value="Officier Logistique">Officier Logistique</option>
                  <option value="Consultant">Consultant</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Organisation</label>
                <select 
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                  value={newPreAuth.organization}
                  onChange={e => setNewPreAuth({...newPreAuth, organization: e.target.value as any})}
                >
                  <option value="Ministère de la Défense">Ministère de la Défense</option>
                  <option value="Forces Armées d'Haïti">Forces Armées d'Haïti</option>
                  <option value="Conjoint (Ministère & FAd'H)">Conjoint (Ministère & FAd'H)</option>
                </select>
              </div>
              <div className="pt-4">
                <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg">
                  Ajouter l'Autorisation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {isAddingItem && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={(e) => {
          if (e.target === e.currentTarget) handleCloseAddItem();
        }}>
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold">Nouvel Article d'Inventaire</h3>
              <button onClick={handleCloseAddItem} className="p-2 hover:bg-slate-100 rounded-full">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleAddItem} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Nom de l'article</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                    value={newItem.name || ''}
                    onChange={e => setNewItem({...newItem, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Numéro de Série / Code Barre</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                    value={newItem.serialNumber || ''}
                    onChange={e => setNewItem({...newItem, serialNumber: e.target.value})}
                    placeholder="S/N: ..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Organisation</label>
                  <select 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                    value={newItem.organization}
                    onChange={e => setNewItem({...newItem, organization: e.target.value as any, militaryUnitId: ''})}
                  >
                    <option value="Ministère de la Défense">Ministère de la Défense</option>
                    <option value="Forces Armées d'Haïti">Forces Armées d'Haïti</option>
                    <option value="Conjoint (Ministère & FAd'H)">Conjoint (Ministère & FAd'H)</option>
                  </select>
                </div>
                {newItem.organization === "Forces Armées d'Haïti" && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Unité Militaire</label>
                    <select 
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                      value={newItem.militaryUnitId || ''}
                      onChange={e => setNewItem({...newItem, militaryUnitId: e.target.value})}
                    >
                      <option value="">Sélectionner une unité...</option>
                      {units.map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Service</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                    value={newItem.service || ''}
                    onChange={e => setNewItem({...newItem, service: e.target.value})}
                    placeholder="ex: Logistique, Transmissions"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Direction</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                    value={newItem.direction || ''}
                    onChange={e => setNewItem({...newItem, direction: e.target.value})}
                    placeholder="ex: Direction Générale"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Direction Départementale</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                    value={newItem.deptDirection || ''}
                    onChange={e => setNewItem({...newItem, deptDirection: e.target.value})}
                    placeholder="ex: Nord, Ouest"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Section / Bureau</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                    value={newItem.section || ''}
                    onChange={e => setNewItem({...newItem, section: e.target.value})}
                    placeholder="ex: Section A"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Catégorie</label>
                  <div className="relative">
                    <input 
                      required
                      type="text" 
                      list="category-suggestions"
                      placeholder="ex: Armement, Véhicule..."
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                      value={newItem.category || ''}
                      onChange={e => setNewItem({...newItem, category: e.target.value})}
                    />
                    <datalist id="category-suggestions">
                      {SUGGESTED_CATEGORIES.map(cat => (
                        <option key={cat} value={cat} />
                      ))}
                    </datalist>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Quantité</label>
                  <input 
                    required
                    type="number" 
                    min="1"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                    value={newItem.quantity || 1}
                    onChange={e => setNewItem({...newItem, quantity: parseInt(e.target.value)})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Seuil Alerte</label>
                  <input 
                    required
                    type="number" 
                    min="0"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                    value={newItem.minThreshold || 0}
                    onChange={e => setNewItem({...newItem, minThreshold: parseInt(e.target.value)})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Valeur Estimée ($)</label>
                  <input 
                    type="number" 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                    value={newItem.estimatedValue || 0}
                    onChange={e => setNewItem({...newItem, estimatedValue: parseFloat(e.target.value)})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Date d'Acquisition</label>
                  <input 
                    type="date" 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                    value={newItem.acquiredDate || ''}
                    onChange={e => setNewItem({...newItem, acquiredDate: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">État</label>
                  <select 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                    value={newItem.condition}
                    onChange={e => setNewItem({...newItem, condition: e.target.value})}
                  >
                    <option value="Neuf">Neuf</option>
                    <option value="Bon">Bon</option>
                    <option value="Usagé">Usagé</option>
                    <option value="Endommagé">Endommagé</option>
                    <option value="En réparation">En réparation</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Emplacement</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                    value={newItem.location || ''}
                    onChange={e => setNewItem({...newItem, location: e.target.value})}
                  />
                </div>

                <div className="col-span-2 space-y-2">
                  <label className="text-sm font-bold text-slate-700">Icône de l'article</label>
                  <div className="grid grid-cols-8 sm:grid-cols-11 gap-2 p-4 bg-slate-50 rounded-2xl border border-slate-200 overflow-y-auto max-h-32">
                    {AVAILABLE_ICONS.map((icon) => (
                      <button
                        key={icon.name}
                        type="button"
                        onClick={() => setNewItem({ ...newItem, icon: icon.name })}
                        className={cn(
                          "p-2 rounded-lg flex items-center justify-center transition-all",
                          newItem.icon === icon.name ? "bg-slate-900 text-white shadow-md" : "hover:bg-slate-200 text-slate-500"
                        )}
                        title={icon.name}
                      >
                        <icon.icon className="w-5 h-5" />
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="col-span-2 pt-4 border-t border-slate-100">
                  <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-slate-400" />
                    Suivi des Munitions (Optionnel - Recommandé pour Armes)
                  </h4>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Type de Munitions</label>
                      <input 
                        type="text" 
                        placeholder="ex: 5.56mm, 9mm"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                        value={newItem.munitions?.type || ''}
                        onChange={e => setNewItem({
                          ...newItem, 
                          munitions: { ...newItem.munitions!, type: e.target.value }
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Quantité de Munitions</label>
                      <input 
                        type="number" 
                        min="0"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                        value={newItem.munitions?.quantity || 0}
                        onChange={e => setNewItem({
                          ...newItem, 
                          munitions: { ...newItem.munitions!, quantity: parseInt(e.target.value) }
                        })}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="pt-4">
                <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg">
                  Enregistrer l'Article
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {isEditingItem && editingItem && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold">Modifier l'Article</h3>
              <button onClick={() => setIsEditingItem(false)} className="p-2 hover:bg-slate-100 rounded-full">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleUpdateItem} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Nom de l'article</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                    value={editingItem.name || ''}
                    onChange={e => setEditingItem({...editingItem, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Numéro de Série / Code Barre</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                    value={editingItem.serialNumber || ''}
                    onChange={e => setEditingItem({...editingItem, serialNumber: e.target.value})}
                    placeholder="S/N: ..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Organisation</label>
                  <select 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                    value={editingItem.organization}
                    onChange={e => setEditingItem({...editingItem, organization: e.target.value as any})}
                  >
                    <option value="Ministère de la Défense">Ministère de la Défense</option>
                    <option value="Forces Armées d'Haïti">Forces Armées d'Haïti</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Catégorie</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                    value={editingItem.category || ''}
                    onChange={e => setEditingItem({...editingItem, category: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Quantité</label>
                  <input 
                    required
                    type="number" 
                    min="1"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                    value={editingItem.quantity || 1}
                    onChange={e => setEditingItem({...editingItem, quantity: parseInt(e.target.value)})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Seuil Alerte</label>
                  <input 
                    required
                    type="number" 
                    min="0"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                    value={editingItem.minThreshold || 0}
                    onChange={e => setEditingItem({...editingItem, minThreshold: parseInt(e.target.value)})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Valeur Estimée ($)</label>
                  <input 
                    type="number" 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                    value={editingItem.estimatedValue || 0}
                    onChange={e => setEditingItem({...editingItem, estimatedValue: parseFloat(e.target.value)})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Date d'Acquisition</label>
                  <input 
                    type="date" 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                    value={editingItem.acquiredDate || ''}
                    onChange={e => setEditingItem({...editingItem, acquiredDate: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">État</label>
                  <select 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                    value={editingItem.condition}
                    onChange={e => setEditingItem({...editingItem, condition: e.target.value})}
                  >
                    <option value="Neuf">Neuf</option>
                    <option value="Bon">Bon</option>
                    <option value="Usagé">Usagé</option>
                    <option value="Endommagé">Endommagé</option>
                    <option value="En réparation">En réparation</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Emplacement</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                    value={editingItem.location || ''}
                    onChange={e => setEditingItem({...editingItem, location: e.target.value})}
                  />
                </div>

                <div className="col-span-2 space-y-2">
                  <label className="text-sm font-bold text-slate-700">Icône de l'article</label>
                  <div className="grid grid-cols-8 sm:grid-cols-11 gap-2 p-4 bg-slate-50 rounded-2xl border border-slate-200 overflow-y-auto max-h-32">
                    {AVAILABLE_ICONS.map((icon) => (
                      <button
                        key={icon.name}
                        type="button"
                        onClick={() => setEditingItem({ ...editingItem, icon: icon.name })}
                        className={cn(
                          "p-2 rounded-lg flex items-center justify-center transition-all",
                          editingItem.icon === icon.name ? "bg-slate-900 text-white shadow-md" : "hover:bg-slate-200 text-slate-500"
                        )}
                        title={icon.name}
                      >
                        <icon.icon className="w-5 h-5" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="col-span-2 pt-4 border-t border-slate-100">
                  <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-slate-400" />
                    Suivi des Munitions (Optionnel - Recommandé pour Armes)
                  </h4>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Type de Munitions</label>
                      <input 
                        type="text" 
                        placeholder="ex: 5.56mm, 9mm"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                        value={editingItem.munitions?.type || ''}
                        onChange={e => setEditingItem({
                          ...editingItem, 
                          munitions: { type: e.target.value, quantity: editingItem.munitions?.quantity || 0 }
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Quantité de Munitions</label>
                      <input 
                        type="number" 
                        min="0"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                        value={editingItem.munitions?.quantity || 0}
                        onChange={e => setEditingItem({
                          ...editingItem, 
                          munitions: { type: editingItem.munitions?.type || '', quantity: parseInt(e.target.value) }
                        })}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="pt-4 flex gap-4">
                <button 
                  type="button"
                  onClick={() => editingItem.id && handleDeleteItem(editingItem.id)}
                  className="flex-1 bg-red-50 text-red-600 py-4 rounded-xl font-bold hover:bg-red-100 transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-5 h-5" />
                  Supprimer
                </button>
                <button type="submit" className="flex-[2] bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg">
                  Mettre à jour l'Article
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Unit Modal */}
      {isAddingUnit && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold">Nouvelle Unité Militaire</h3>
              <button onClick={() => setIsAddingUnit(false)} className="p-2 hover:bg-slate-100 rounded-full">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleAddUnit} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Nom de l'unité</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                    value={newUnit.name || ''}
                    onChange={e => setNewUnit({...newUnit, name: e.target.value})}
                    placeholder="ex: Corps d'Aviation"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Branche</label>
                  <select 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                    value={newUnit.branch}
                    onChange={e => setNewUnit({...newUnit, branch: e.target.value as any})}
                  >
                    <option value="Armée de Terre">Armée de Terre</option>
                    <option value="Corps d'Aviation">Corps d'Aviation</option>
                    <option value="Garde-Côtes">Garde-Côtes</option>
                    <option value="Génie Militaire">Génie Militaire</option>
                    <option value="Service de Santé">Service de Santé</option>
                    <option value="Autre">Autre</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Localisation</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                    value={newUnit.location || ''}
                    onChange={e => setNewUnit({...newUnit, location: e.target.value})}
                    placeholder="Base ou Caserne"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Commandant</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                    value={newUnit.commander || ''}
                    onChange={e => setNewUnit({...newUnit, commander: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Effectif</label>
                  <input 
                    type="number" 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                    value={newUnit.personnelCount || 0}
                    onChange={e => setNewUnit({...newUnit, personnelCount: parseInt(e.target.value)})}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Description / Mission</label>
                <textarea 
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900 h-24"
                  value={newUnit.description || ''}
                  onChange={e => setNewUnit({...newUnit, description: e.target.value})}
                />
              </div>
              <div className="pt-4">
                <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg">
                  Créer l'Unité
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Unit Modal */}
      {isEditingUnit && editingUnit && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold">Modifier l'Unité</h3>
              <button onClick={() => setIsEditingUnit(false)} className="p-2 hover:bg-slate-100 rounded-full">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleUpdateUnit} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Nom de l'unité</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                    value={editingUnit.name || ''}
                    onChange={e => setEditingUnit({...editingUnit, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Branche</label>
                  <select 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                    value={editingUnit.branch}
                    onChange={e => setEditingUnit({...editingUnit, branch: e.target.value as any})}
                  >
                    <option value="Armée de Terre">Armée de Terre</option>
                    <option value="Corps d'Aviation">Corps d'Aviation</option>
                    <option value="Garde-Côtes">Garde-Côtes</option>
                    <option value="Génie Militaire">Génie Militaire</option>
                    <option value="Service de Santé">Service de Santé</option>
                    <option value="Autre">Autre</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Localisation</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                    value={editingUnit.location || ''}
                    onChange={e => setEditingUnit({...editingUnit, location: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Commandant</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                    value={editingUnit.commander || ''}
                    onChange={e => setEditingUnit({...editingUnit, commander: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Effectif</label>
                  <input 
                    type="number" 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                    value={editingUnit.personnelCount || 0}
                    onChange={e => setEditingUnit({...editingUnit, personnelCount: parseInt(e.target.value)})}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Description / Mission</label>
                <textarea 
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900 h-24"
                  value={editingUnit.description || ''}
                  onChange={e => setEditingUnit({...editingUnit, description: e.target.value})}
                />
              </div>
              <div className="pt-4 flex gap-4">
                <button 
                  type="button"
                  onClick={() => editingUnit.id && handleDeleteUnit(editingUnit.id)}
                  className="flex-1 bg-red-50 text-red-600 py-4 rounded-xl font-bold hover:bg-red-100 transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-5 h-5" />
                  Supprimer
                </button>
                <button type="submit" className="flex-[2] bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg">
                  Mettre à jour l'Unité
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Movement Modal */}
      {isAddingMovement && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold">Enregistrer un Mouvement</h3>
              <button onClick={() => setIsAddingMovement(false)} className="p-2 hover:bg-slate-100 rounded-full">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleAddMovement} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2 col-span-2">
                  <label className="text-sm font-bold text-slate-700">Article à déplacer</label>
                  <select 
                    required
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                    value={newMovement.itemId || ''}
                    onChange={e => {
                      const item = items.find(i => i.id === e.target.value);
                      setNewMovement({
                        ...newMovement, 
                        itemId: e.target.value,
                        itemName: item?.name,
                        itemType: item?.category as any
                      });
                    }}
                  >
                    <option value="">Sélectionner un article...</option>
                    {items.map(i => (
                      <option key={i.id} value={i.id}>{i.name} ({i.quantity} en stock)</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Quantité</label>
                  <input 
                    required
                    type="number" 
                    min="1"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                    value={newMovement.quantity || 1}
                    onChange={e => setNewMovement({...newMovement, quantity: parseInt(e.target.value)})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Statut</label>
                  <select 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                    value={newMovement.status}
                    onChange={e => setNewMovement({...newMovement, status: e.target.value as any})}
                  >
                    <option value="En transit">En transit</option>
                    <option value="Livré">Livré</option>
                    <option value="Annulé">Annulé</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Unité d'Origine</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                    value={newMovement.originUnit || ''}
                    onChange={e => setNewMovement({...newMovement, originUnit: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Unité de Destination</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                    value={newMovement.destinationUnit || ''}
                    onChange={e => setNewMovement({...newMovement, destinationUnit: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Date de Départ</label>
                  <input 
                    required
                    type="date" 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                    value={newMovement.departureDate || ''}
                    onChange={e => setNewMovement({...newMovement, departureDate: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Date d'Arrivée (Prévue)</label>
                  <input 
                    type="date" 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                    value={newMovement.arrivalDate || ''}
                    onChange={e => setNewMovement({...newMovement, arrivalDate: e.target.value})}
                  />
                </div>
              </div>
              <div className="pt-4">
                <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg">
                  Confirmer le Mouvement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* View Unit Details Modal */}
      {isViewingUnit && viewingUnit && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-900 text-white">
              <h3 className="text-xl font-bold">Détails de l'Unité</h3>
              <button onClick={() => setIsViewingUnit(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="bg-slate-100 p-4 rounded-2xl">
                  <Users className="w-8 h-8 text-slate-900" />
                </div>
                <div>
                  <h4 className="text-2xl font-bold text-slate-900">{viewingUnit.name}</h4>
                  <span className="inline-block px-2 py-1 bg-slate-100 text-slate-600 text-xs font-bold uppercase rounded mt-1">
                    {viewingUnit.branch}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Localisation</p>
                  <div className="flex items-center gap-2 text-slate-700 font-medium">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    {viewingUnit.location || 'Non spécifié'}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Commandant</p>
                  <div className="flex items-center gap-2 text-slate-700 font-medium">
                    <UserIcon className="w-4 h-4 text-slate-400" />
                    {viewingUnit.commander || 'Non spécifié'}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Effectif</p>
                  <div className="flex items-center gap-2 text-slate-700 font-medium">
                    <Package className="w-4 h-4 text-slate-400" />
                    {viewingUnit.personnelCount || 0} membres
                  </div>
                </div>
              </div>

              <div className="space-y-1 pt-4 border-t border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Description / Mission</p>
                <p className="text-slate-600 leading-relaxed italic">
                  {viewingUnit.description || 'Aucune description fournie pour cette unité.'}
                </p>
              </div>

              <div className="pt-6">
                <button 
                  onClick={() => setIsViewingUnit(false)}
                  className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Close Confirmation Modal */}
      {showCloseConfirmation && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 text-center">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Changements non enregistrés</h3>
            <p className="text-slate-500 mb-8">Êtes-vous sûr de vouloir quitter sans enregistrer ? Vos modifications seront perdues.</p>
            <div className="flex gap-4">
              <button 
                onClick={() => setShowCloseConfirmation(false)}
                className="flex-1 px-6 py-3 rounded-xl border border-slate-200 font-bold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Continuer l'édition
              </button>
              <button 
                onClick={confirmClose}
                className="flex-1 px-6 py-3 rounded-xl bg-red-600 font-bold text-white hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
              >
                Quitter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NavItem({ icon, label, active, collapsed, onClick }: { icon: React.ReactNode, label: string, active?: boolean, collapsed?: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-4 p-3 rounded-xl transition-all group",
        active ? "bg-white text-slate-900 shadow-lg" : "text-slate-400 hover:text-white hover:bg-white/5"
      )}
    >
      <div className={cn("transition-transform group-hover:scale-110", active ? "text-slate-900" : "text-slate-400 group-hover:text-white")}>
        {React.cloneElement(icon as React.ReactElement<any>, { className: "w-6 h-6" })}
      </div>
      {!collapsed && <span className="font-medium whitespace-nowrap">{label}</span>}
    </button>
  );
}

function StatCard({ title, value, icon, trend }: { title: string, value: number, icon: React.ReactNode, trend?: string }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-slate-50 rounded-lg">
          {icon}
        </div>
        {trend && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600 bg-orange-50 px-2 py-1 rounded-full">
            {trend}
          </span>
        )}
      </div>
      <p className="text-slate-500 text-sm font-medium mb-1">{title}</p>
      <p className="text-3xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

export default App;
