import React, { useState, useEffect, Component, ReactNode } from 'react';
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
  User as UserIcon,
  Truck,
  ArrowRightLeft,
  Calendar,
  Download,
  History
} from 'lucide-react';
import { 
  doc, 
  updateDoc, 
  addDoc, 
  onSnapshot, 
  collection,
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
  organization: 'Ministère de la Défense' | 'Forces Armées d\'Haïti';
  quantity: number;
  minThreshold: number;
  condition: string;
  location: string;
  serialNumber?: string;
  lastInventoryDate?: string;
  acquiredDate?: string;
  estimatedValue?: number;
  description?: string;
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

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory' | 'movements' | 'reports'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOrg, setFilterOrg] = useState<string>('All');
  
  // Report Filters
  const [reportFilters, setReportFilters] = useState({
    category: 'All',
    unit: 'All',
    status: 'All',
    dateFrom: '',
    dateTo: ''
  });

  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isAddingMovement, setIsAddingMovement] = useState(false);
  const [isEditingItem, setIsEditingItem] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [newItem, setNewItem] = useState<Partial<InventoryItem>>({
    organization: 'Ministère de la Défense',
    quantity: 1,
    minThreshold: 5,
    condition: 'Bon'
  });
  const [newMovement, setNewMovement] = useState<Partial<Movement>>({
    status: 'En transit',
    departureDate: new Date().toISOString().split('T')[0]
  });

  // Auth Listener
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
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

    return () => {
      unsubItems();
      unsubMovements();
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
        condition: 'Bon'
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
    if (!db || !user || !editingItem) return;
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

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         item.serialNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesOrg = filterOrg === 'All' || item.organization === filterOrg;
    return matchesSearch && matchesOrg;
  });

  const lowStockItems = items.filter(item => item.quantity <= (item.minThreshold || 0));

  const stats = {
    total: items.length,
    mdh: items.filter(i => i.organization === 'Ministère de la Défense').length,
    fadh: items.filter(i => i.organization === 'Forces Armées d\'Haïti').length,
    damaged: items.filter(i => i.condition === 'Endommagé' || i.condition === 'En réparation').length
  };

  const chartData = [
    { name: 'MDH', count: stats.mdh },
    { name: 'FAd\'H', count: stats.fadh }
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
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-slate-200">
          <div className="bg-slate-900 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg rotate-3">
            <Shield className="text-white w-10 h-10" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Logistique MDH & FAd'H</h1>
          <p className="text-slate-500 mb-8">Système de gestion des matériels et mobiliers du Ministère de la Défense d'Haïti.</p>
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
            icon={<BarChart3 />} 
            label="Rapports" 
            active={activeTab === 'reports'} 
            collapsed={!isSidebarOpen}
            onClick={() => setActiveTab('reports')}
          />
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
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-slate-900">{user.displayName}</p>
              <p className="text-xs text-slate-500">Officier Logistique</p>
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Total Articles" value={stats.total} icon={<Package className="text-blue-600" />} />
                <StatCard title="Ministère (MDH)" value={stats.mdh} icon={<Shield className="text-slate-900" />} />
                <StatCard title="Forces Armées (FAd'H)" value={stats.fadh} icon={<Shield className="text-red-600" />} />
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
                  </select>
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
                          <div>
                            <p className="font-bold text-slate-900">{item.name}</p>
                            <p className="text-xs text-slate-500 font-mono">{item.serialNumber || 'S/N: N/A'}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-3 py-1 rounded-full text-xs font-bold",
                            item.organization === 'Ministère de la Défense' ? "bg-slate-100 text-slate-700" : "bg-red-50 text-red-700"
                          )}>
                            {item.organization === 'Ministère de la Défense' ? 'MDH' : 'FAd\'H'}
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
                            className="p-2 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-900 transition-colors"
                          >
                            <Settings className="w-5 h-5" />
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
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
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
                    <label className="text-xs font-bold text-slate-500 uppercase">Unité/Force</label>
                    <select 
                      className="w-full p-3 rounded-xl border border-slate-200 outline-none"
                      value={reportFilters.unit}
                      onChange={e => setReportFilters({...reportFilters, unit: e.target.value})}
                    >
                      <option value="All">Toutes</option>
                      <option value="Ministère de la Défense">Ministère</option>
                      <option value="Forces Armées d'Haïti">FAd'H</option>
                    </select>
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
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Depuis</label>
                    <input 
                      type="date" 
                      className="w-full p-3 rounded-xl border border-slate-200 outline-none"
                      value={reportFilters.dateFrom}
                      onChange={e => setReportFilters({...reportFilters, dateFrom: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Jusqu'à</label>
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
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Localisation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items
                      .filter(i => {
                        const catMatch = reportFilters.category === 'All' || i.category === reportFilters.category;
                        const unitMatch = reportFilters.unit === 'All' || i.organization === reportFilters.unit;
                        const statusMatch = reportFilters.status === 'All' || i.condition === reportFilters.status;
                        const dateFromMatch = !reportFilters.dateFrom || (i.acquiredDate && i.acquiredDate >= reportFilters.dateFrom);
                        const dateToMatch = !reportFilters.dateTo || (i.acquiredDate && i.acquiredDate <= reportFilters.dateTo);
                        return catMatch && unitMatch && statusMatch && dateFromMatch && dateToMatch;
                      })
                      .map(item => (
                        <tr key={item.id} className="text-sm">
                          <td className="px-6 py-4 font-bold">{item.name}</td>
                          <td className="px-6 py-4 text-slate-500">{item.description || 'N/A'}</td>
                          <td className="px-6 py-4 font-mono">{item.quantity}</td>
                          <td className="px-6 py-4 font-mono text-emerald-600">${item.estimatedValue?.toLocaleString() || '0'}</td>
                          <td className="px-6 py-4">{item.location}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Add Item Modal */}
      {isAddingItem && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold">Nouvel Article d'Inventaire</h3>
              <button onClick={() => setIsAddingItem(false)} className="p-2 hover:bg-slate-100 rounded-full">
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
                  <label className="text-sm font-bold text-slate-700">Organisation</label>
                  <select 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                    value={newItem.organization}
                    onChange={e => setNewItem({...newItem, organization: e.target.value as any})}
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
                    placeholder="ex: Mobilier, Véhicule..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900"
                    value={newItem.category || ''}
                    onChange={e => setNewItem({...newItem, category: e.target.value})}
                  />
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
              </div>
              <div className="pt-4">
                <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg">
                  Mettre à jour l'Article
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
