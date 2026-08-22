import { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  MapPin,
  Users,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  PlusCircle,
  Clock,
  Compass,
  CreditCard,
  UserCheck,
  Trash2,
  LogOut,
  Share2,
  Settings,
  X,
  FileDown
} from 'lucide-react';
import './App.css';

// Configuración de la URL de la API. 
// En Capacitor (Android/iOS), 'localhost' apunta al propio dispositivo móvil.
// - Para el Emulador de Android, usa 'http://10.0.2.2:5000/api' para conectarse al servidor de la PC.
// - Para un dispositivo físico, cambia '10.0.2.2' por la dirección IP local de tu PC (ej: 'http://192.168.1.50:5000/api').
const getApiUrl = () => {
  // If an environment variable is defined (e.g., in Vercel for production)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  const win = window as any;
  const isNative = win.Capacitor && typeof win.Capacitor.isNativePlatform === 'function' && win.Capacitor.isNativePlatform();
  if (isNative) {
    // IP local de tu computadora para pruebas en dispositivo físico
    return 'http://192.168.0.24:5000/api';
  }
  // Usar dinámicamente el hostname desde el cual se cargó la aplicación web
  const hostname = window.location.hostname || 'localhost';
  return `http://${hostname}:5000/api`;
};

const API_URL = getApiUrl();

type TabType = 'dashboard' | 'rutas' | 'clientes' | 'creditos' | 'pagos' | 'gastos' | 'liquidaciones' | 'usuarios' | 'configuraciones';

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('zenu_token'));
  const [user, setUser] = useState<{ id_usuario: number; nombre: string; email: string; rol: string } | null>(
    localStorage.getItem('zenu_user') ? JSON.parse(localStorage.getItem('zenu_user')!) : null
  );

  // Login Form States
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // App States
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [dbTime, setDbTime] = useState<string>('');
  const [loadingHealth, setLoadingHealth] = useState(false);

  // Entities States
  const [clientes, setClientes] = useState<any[]>([]);
  const [creditos, setCreditos] = useState<any[]>([]);
  const [pagos, setPagos] = useState<any[]>([]);
  const [rutas, setRutas] = useState<any[]>([]);
  const [gastos, setGastos] = useState<any[]>([]);
  const [liquidaciones, setLiquidaciones] = useState<any[]>([]);
  const [usuariosList, setUsuariosList] = useState<any[]>([]);
  const [cobradoresList, setCobradoresList] = useState<any[]>([]);
  const [cobradoresUbicaciones, setCobradoresUbicaciones] = useState<any[]>([]);
  const [adminMapFilter, setAdminMapFilter] = useState<'both' | 'clients' | 'collectors'>('both');

  // Editing States (Exclusivos para ADMIN)
  const [editingClient, setEditingClient] = useState<any | null>(null);
  const [editingCredit, setEditingCredit] = useState<any | null>(null);
  const [editingUser, setEditingUser] = useState<any | null>(null);

  // Statistics State
  const [stats, setStats] = useState({
    totalCapitalEnCalle: 0,
    totalPrestado: 0,
    totalRecaudadoHoy: 0,
    clientesActivosCount: 0,
    totalClientesCount: 0,
    moraGlobalPercent: 0
  });

  // Forms states
  const [newClient, setNewClient] = useState({ documento: '', nombre: '', telefono: '', direccion: '', rutaId: '' });
  const [newCredit, setNewCredit] = useState({ clienteId: '', monto: 500000, tasa: 20, frecuencia: 'DIARIO', cuotas: 30 });
  const [routeAssignment, setRouteAssignment] = useState({ rutaId: '', cobradorId: '' });
  const [newGasto, setNewGasto] = useState({ descripcion: '', monto: '' });
  const [newPayment, setNewPayment] = useState({ creditoId: '', monto: '', tipo: 'EFECTIVO', lat: '', lng: '' });
  const [newUser, setNewUser] = useState({ nombre: '', email: '', password: '', rol: 'COBRADOR' });
  const [newRoute, setNewRoute] = useState({ nombre_ruta: '', id_cobrador: '' });
  const [editingRoute, setEditingRoute] = useState<{ id: number; nombre_ruta: string; id_cobrador: string | number | null } | null>(null);

  // Receipt POS modal states
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>((localStorage.getItem('zenu_theme') as 'dark' | 'light') || 'dark');
  
  // Offline synchronization states
  const [offlinePayments, setOfflinePayments] = useState<any[]>(() => {
    const saved = localStorage.getItem('zenu_offline_payments');
    return saved ? JSON.parse(saved) : [];
  });
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Daily Closure (Liquidación) States
  const [liqForm, setLiqForm] = useState({
    cobradorId: '',
    fecha: new Date().toISOString().split('T')[0],
    efectivoEntregado: ''
  });
  const [liqPreview, setLiqPreview] = useState<{
    cobradorId: number;
    fecha: string;
    totalRecaudado: number;
    totalGastos: number;
    efectivoEsperado: number;
    pagosDetalle?: any[];
    gastosDetalle?: any[];
  } | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Authenticated fetch wrapper
  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers,
    };
    const response = await fetch(url, { ...options, headers });
    if (response.status === 401) {
      handleLogout();
      throw new Error('Sesión expirada.');
    }
    return response;
  };

  // Check backend health
  const checkHealth = async () => {
    setLoadingHealth(true);
    try {
      const response = await fetch(`${API_URL}/health`);
      if (response.ok) {
        const data = await response.json();
        setApiOnline(data.status === 'success');
        setDbTime(data.db_time || new Date().toLocaleString());
      } else {
        setApiOnline(false);
      }
    } catch (error) {
      setApiOnline(false);
    } finally {
      setLoadingHealth(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('zenu_token');
    localStorage.removeItem('zenu_user');
    setToken(null);
    setUser(null);
    setActiveTab('dashboard');
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!loginEmail || !loginPassword) {
      setLoginError('Por favor ingrese el correo y contraseña.');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        localStorage.setItem('zenu_token', data.data.token);
        localStorage.setItem('zenu_user', JSON.stringify(data.data.usuario));
        setToken(data.data.token);
        setUser(data.data.usuario);
      } else {
        setLoginError(data.message || 'Credenciales inválidas.');
      }
    } catch (error) {
      setLoginError('Error de conexión con el servidor. Asegúrese de que la API esté activa.');
    }
  };

  // Load all app data from backend API
  const loadAppData = async () => {
    if (!token) return;
    try {
      // 1. Dashboard stats
      const statsRes = await fetchWithAuth(`${API_URL}/dashboard/stats`);
      if (statsRes.ok) {
        const s = await statsRes.json();
        setStats(s.data);
      }

      // 2. Rutas
      const rutasRes = await fetchWithAuth(`${API_URL}/rutas`);
      if (rutasRes.ok) {
        const r = await rutasRes.json();
        setRutas(r.data);
        if (r.data.length > 0 && !routeAssignment.rutaId) {
          setRouteAssignment(prev => ({ ...prev, rutaId: r.data[0].id.toString() }));
        }
      }

      // 3. Clientes
      const clientesRes = await fetchWithAuth(`${API_URL}/clientes`);
      if (clientesRes.ok) {
        const c = await clientesRes.json();
        setClientes(c.data);
        if (c.data.length > 0 && !newCredit.clienteId) {
          setNewCredit(prev => ({ ...prev, clienteId: c.data[0].id.toString() }));
        }
      }

      // 4. Créditos
      const creditosRes = await fetchWithAuth(`${API_URL}/creditos`);
      if (creditosRes.ok) {
        const cr = await creditosRes.json();
        setCreditos(cr.data);
        const activeCreds = cr.data.filter((c: any) => c.estado !== 'PAGADO');
        if (activeCreds.length > 0 && !newPayment.creditoId) {
          setNewPayment(prev => ({ ...prev, creditoId: activeCreds[0].id.toString() }));
        }
      }

      // 5. Pagos
      const pagosRes = await fetchWithAuth(`${API_URL}/pagos`);
      if (pagosRes.ok) {
        const p = await pagosRes.json();
        setPagos(p.data);
      }

      // 6. Gastos
      const gastosRes = await fetchWithAuth(`${API_URL}/gastos`);
      if (gastosRes.ok) {
        const g = await gastosRes.json();
        setGastos(g.data);
      }

      // 7. Liquidaciones
      const liqRes = await fetchWithAuth(`${API_URL}/liquidaciones`);
      if (liqRes.ok) {
        const l = await liqRes.json();
        setLiquidaciones(l.data);
      }

      // 8. Usuarios del sistema (Solo ADMIN)
      if (user?.rol === 'ADMIN') {
        const usersRes = await fetchWithAuth(`${API_URL}/usuarios`);
        if (usersRes.ok) {
          const u = await usersRes.json();
          setUsuariosList(u.data);
          const cobradores = u.data.filter((usr: any) => usr.estado);
          setCobradoresList(cobradores);

          if (cobradores.length > 0) {
            if (!routeAssignment.cobradorId) {
              setRouteAssignment(prev => ({ ...prev, cobradorId: cobradores[0].id.toString() }));
            }
            if (!liqForm.cobradorId) {
              setLiqForm(prev => ({ ...prev, cobradorId: cobradores[0].id.toString() }));
            }
          }
        }
      } else {
        setCobradoresList([
          { id: user?.id_usuario, nombre: user?.nombre, email: user?.email }
        ]);
      }
    } catch (error) {
      console.error('Error cargando datos de la API:', error);
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const exportToCSV = (data: any[], filename: string, headers: string[]) => {
    const csvRows = [];
    csvRows.push(headers.join(';'));
    
    data.forEach(row => {
      const values = row.map((val: any) => {
        if (val === null || val === undefined) return '';
        const cleanVal = String(val).replace(/"/g, '""');
        return cleanVal.includes(';') || cleanVal.includes('\n') || cleanVal.includes('"') 
          ? `"${cleanVal}"` 
          : cleanVal;
      });
      csvRows.push(values.join(';'));
    });
    
    const csvContent = '\uFEFF' + csvRows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSendReminder = (c: any) => {
    const formattedCuota = c.valorCuota.toLocaleString();
    const formattedSaldo = c.saldoPendiente.toLocaleString();
    const cleanPhone = c.clienteTelefono ? c.clienteTelefono.replace(/[^0-9]/g, '') : '';
    const text = `Hola *${c.clienteNombre}*, te recordamos que tu cuota de hoy por *$${formattedCuota}* se encuentra pendiente. Saldo restante: *$${formattedSaldo}* COP.`;
    
    window.open(`https://api.whatsapp.com/send?phone=57${cleanPhone}&text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleDownloadBackup = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/dashboard/backup`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Zenu_Backup_${new Date().toISOString().split('T')[0]}.zip`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        alert('Copia de seguridad descargada exitosamente.');
      } else {
        const data = await res.json();
        alert(data.message || 'Error al descargar la copia de seguridad.');
      }
    } catch (error) {
      console.error(error);
      alert('Error al conectar con el servidor.');
    }
  };

  const handleSendTestBackupEmail = async () => {
    try {
      setIsSyncing(true);
      const res = await fetchWithAuth(`${API_URL}/dashboard/backup/test-email`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        alert('Correo de prueba enviado con éxito con los 7 archivos CSV adjuntos.');
      } else {
        alert(data.message || 'Error al enviar el correo de prueba. Verifique su archivo .env.');
      }
    } catch (error) {
      console.error(error);
      alert('Error al conectar con el servidor.');
    } finally {
      setIsSyncing(false);
    }
  };

  const syncOfflinePayments = async () => {
    if (offlinePayments.length === 0 || isSyncing) return;
    setIsSyncing(true);
    
    let syncedCount = 0;
    const queue = [...offlinePayments];
    const remaining = [];
    
    for (const pay of queue) {
      try {
        const res = await fetchWithAuth(`${API_URL}/pagos`, {
          method: 'POST',
          body: JSON.stringify({
            creditoId: pay.creditoId,
            monto: pay.monto,
            tipo: pay.tipo,
            lat: pay.lat,
            lng: pay.lng,
            cobradorId: user?.id_usuario
          })
        });
        
        if (res.ok) {
          syncedCount++;
        } else {
          remaining.push(pay);
        }
      } catch (error) {
        console.error('Error sincronizando pago offline:', error);
        remaining.push(pay);
      }
    }
    
    setOfflinePayments(remaining);
    localStorage.setItem('zenu_offline_payments', JSON.stringify(remaining));
    setIsSyncing(false);
    
    if (syncedCount > 0) {
      alert(`Se sincronizaron exitosamente ${syncedCount} pagos con el servidor.`);
      loadAppData();
    }
  };

  useEffect(() => {
    if (apiOnline && offlinePayments.length > 0 && !isSyncing) {
      syncOfflinePayments();
    }
  }, [apiOnline, offlinePayments.length]);

  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
    localStorage.setItem('zenu_theme', theme);
  }, [theme]);

  useEffect(() => {
    if (token) {
      loadAppData();
    }
  }, [token]);

  // Capture GPS coords for new payment
  useEffect(() => {
    if (activeTab === 'pagos' && token) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setNewPayment(prev => ({
              ...prev,
              lat: position.coords.latitude.toString(),
              lng: position.coords.longitude.toString()
            }));
          },
          () => {
            setNewPayment(prev => ({
              ...prev,
              lat: '10.411320',
              lng: '-75.289210'
            }));
          }
        );
      }
    }
  }, [activeTab, token]);

  // Enviar ubicación en tiempo real si es COBRADOR
  useEffect(() => {
    if (token && user?.rol === 'COBRADOR') {
      const enviarUbicacion = () => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            try {
              await fetch(`${API_URL}/usuarios/ubicacion`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                  lat: position.coords.latitude,
                  lng: position.coords.longitude
                })
              });
            } catch (error) {
              console.error("Error al enviar la ubicación:", error);
            }
          },
          (error) => {
            console.error("Error al obtener geolocalización:", error);
          },
          { enableHighAccuracy: true }
        );
      };

      enviarUbicacion();
      const interval = setInterval(enviarUbicacion, 30000); // Reportar cada 30 segundos
      return () => clearInterval(interval);
    }
  }, [token, user]);

  // Consultar ubicaciones de cobradores en tiempo real si es ADMIN
  useEffect(() => {
    if (token && user?.rol === 'ADMIN' && activeTab === 'dashboard') {
      const obtenerUbicaciones = async () => {
        try {
          const response = await fetch(`${API_URL}/usuarios/ubicaciones`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          const result = await response.json();
          if (result.status === 'success') {
            setCobradoresUbicaciones(result.data);
          }
        } catch (error) {
          console.error("Error al obtener ubicaciones de cobradores:", error);
        }
      };

      obtenerUbicaciones();
      const interval = setInterval(obtenerUbicaciones, 15000); // Polling cada 15 segundos
      return () => clearInterval(interval);
    }
  }, [token, user, activeTab]);

  // Lógica de Ruta del Cobrador y Siguiente Cliente
  const cobradorRoute = rutas.find(r => r.cobradorId === user?.id_usuario || r.cobrador === user?.nombre);
  const routeClients = clientes.filter(c => c.rutaId === cobradorRoute?.id || c.rutaNombre === cobradorRoute?.nombre_ruta);
  const routeCredits = creditos.filter(cr => 
    routeClients.some(c => c.nombre === cr.clienteNombre || c.documento === cr.documento) && cr.estado !== 'PAGADO'
  );
  
  // Pagos del cobrador hoy
  const todayDateString = new Date().toISOString().split('T')[0];
  const todayPayments = pagos.filter(p => p.fecha.includes(todayDateString) || p.fecha.includes('Hoy'));
  const paidTodayNames = todayPayments.map(p => p.clienteNombre);
  
  // Clientes pendientes
  const pendingCredits = routeCredits.filter(cr => !paidTodayNames.includes(cr.clienteNombre));
  const clientesPendientesCount = pendingCredits.length;

  // Google Maps / Leaflet map renderer (Con soporte para el "Siguiente Cliente" del Cobrador)
  useEffect(() => {
    if (activeTab === 'dashboard' && token && mapContainerRef.current) {
      const google = (window as any).google;
      if (google && google.maps) {
        // Calcular centro por defecto
        const paymentWithCoords = pagos.find(p => p.lat && p.lng);
        const centerLat = paymentWithCoords ? paymentWithCoords.lat : 10.411320;
        const centerLng = paymentWithCoords ? paymentWithCoords.lng : -75.289210;

        const center = { lat: centerLat, lng: centerLng };
        const map = new google.maps.Map(mapContainerRef.current, {
          center: center,
          zoom: 14,
          disableDefaultUI: false,
          styles: [
            { elementType: "geometry", stylers: [{ color: "#1e293b" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#1e293b" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
            {
              featureType: "administrative.locality",
              elementType: "labels.text.fill",
              stylers: [{ color: "#cbd5e1" }],
            },
            {
              featureType: "poi",
              elementType: "labels.text.fill",
              stylers: [{ color: "#6366f1" }],
            },
            {
              featureType: "poi.park",
              elementType: "geometry",
              stylers: [{ color: "#0f172a" }],
            },
            {
              featureType: "poi.park",
              elementType: "labels.text.fill",
              stylers: [{ color: "#475569" }],
            },
            {
              featureType: "road",
              elementType: "geometry",
              stylers: [{ color: "#0f172a" }],
            },
            {
              featureType: "road",
              elementType: "geometry.stroke",
              stylers: [{ color: "#1e293b" }],
            },
            {
              featureType: "road.highway",
              elementType: "geometry",
              stylers: [{ color: "#312e81" }],
            },
            {
              featureType: "road.highway",
              elementType: "geometry.stroke",
              stylers: [{ color: "#1e293b" }],
            },
            {
              featureType: "road.highway",
              elementType: "labels.text.fill",
              stylers: [{ color: "#818cf8" }],
            },
            {
              featureType: "water",
              elementType: "geometry",
              stylers: [{ color: "#020617" }],
            },
            {
              featureType: "water",
              elementType: "labels.text.fill",
              stylers: [{ color: "#1e293b" }],
            },
            {
              featureType: "water",
              elementType: "labels.text.stroke",
              stylers: [{ color: "#020617" }],
            },
          ]
        });

        if (user?.rol === 'ADMIN') {
          pagos.forEach(p => {
            if (p.lat && p.lng) {
              const marker = new google.maps.Marker({
                position: { lat: p.lat, lng: p.lng },
                map: map,
                title: p.clienteNombre,
              });

              const infoWindow = new google.maps.InfoWindow({
                content: `
                  <div style="font-family: 'Outfit', sans-serif; color: #111; min-width: 140px; padding: 4px;">
                    <h4 style="margin: 0 0 4px 0; font-size: 0.9rem; font-weight: 700; color: #1e293b;">${p.clienteNombre}</h4>
                    <p style="margin: 0 0 4px 0; font-size: 0.8rem; color: #334155;">Abono: <b>$${p.monto.toLocaleString()} COP</b></p>
                    <p style="margin: 0 0 2px 0; font-size: 0.7rem; color: #64748b;">${p.fecha.split('T')[0]}</p>
                    <span style="font-size: 0.7rem; color: #94a3b8; text-transform: uppercase;">Cobró: ${p.cobrador}</span>
                  </div>
                `
              });

              marker.addListener('click', () => {
                infoWindow.open(map, marker);
              });
            }
          });
        } else {
          const myPayments = todayPayments.filter(p => p.cobrador === user?.nombre);
          myPayments.forEach(p => {
            if (p.lat && p.lng) {
              const greenPin = {
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: "#10b981",
                fillOpacity: 0.9,
                scale: 8,
                strokeColor: "#ffffff",
                strokeWeight: 2,
              };

              const marker = new google.maps.Marker({
                position: { lat: p.lat, lng: p.lng },
                map: map,
                icon: greenPin,
                title: p.clienteNombre,
              });

              const infoWindow = new google.maps.InfoWindow({
                content: `<div style="font-family: 'Outfit', sans-serif; color: #111; padding: 4px;"><b>${p.clienteNombre}</b><br/>Abonado hoy: $${p.monto.toLocaleString()} COP</div>`
              });

              marker.addListener('click', () => {
                infoWindow.open(map, marker);
              });
            }
          });

          if (pendingCredits.length > 0) {
            const nextClient = pendingCredits[0];
            const lastPayment = pagos.find(p => p.clienteNombre === nextClient.clienteNombre && p.lat && p.lng);
            const clientLat = lastPayment ? lastPayment.lat : (10.411320 + (nextClient.id * 0.0018));
            const clientLng = lastPayment ? lastPayment.lng : (-75.289210 - (nextClient.id * 0.0018));

            const orangePin = {
              path: google.maps.SymbolPath.CIRCLE,
              fillColor: "#f59e0b",
              fillOpacity: 0.9,
              scale: 10,
              strokeColor: "#ffffff",
              strokeWeight: 2.5,
            };

            const marker = new google.maps.Marker({
              position: { lat: clientLat, lng: clientLng },
              map: map,
              icon: orangePin,
              title: `Siguiente: ${nextClient.clienteNombre}`,
            });

            const nextClientDetail = clientes.find(c => c.documento === nextClient.documento);
            const infoWindow = new google.maps.InfoWindow({
              content: `
                <div style="font-family: 'Outfit', sans-serif; color: #111; min-width: 150px; padding: 4px;">
                  <h4 style="margin: 0 0 4px 0; font-size: 0.95rem; font-weight: 700; color: #d97706;">👉 Siguiente Cliente</h4>
                  <p style="margin: 0 0 2px 0; font-size: 0.9rem; font-weight: 600;">${nextClient.clienteNombre}</p>
                  <p style="margin: 0 0 4px 0; font-size: 0.8rem; color: #334155;">Monto a cobrar: <b>$${nextClient.valorCuota.toLocaleString()} COP</b></p>
                  <span style="font-size: 0.75rem; color: #64748b;">Dir: ${nextClientDetail?.direccion || 'No disponible'}</span>
                </div>
              `
            });

            marker.addListener('click', () => {
              infoWindow.open(map, marker);
            });

            infoWindow.open(map, marker);
          }
        }

        return () => {
          if (mapContainerRef.current) {
            mapContainerRef.current.innerHTML = '';
          }
        };
      }

      // FALLBACK a Leaflet Map
      const L = (window as any).L;
      if (!L) return;

      const paymentWithCoords = pagos.find(p => p.lat && p.lng);
      const centerLat = paymentWithCoords ? paymentWithCoords.lat : 10.411320;
      const centerLng = paymentWithCoords ? paymentWithCoords.lng : -75.289210;

      const map = L.map(mapContainerRef.current).setView([centerLat, centerLng], 14);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);

      if (user?.rol === 'ADMIN') {
        // Dibujar pagos del día (si el filtro es 'both' o 'clients')
        if (adminMapFilter === 'both' || adminMapFilter === 'clients') {
          pagos.forEach(p => {
            if (p.lat && p.lng) {
              L.marker([p.lat, p.lng])
                .addTo(map)
                .bindPopup(`
                  <div style="font-family: 'Outfit', sans-serif; color: #111; min-width: 140px;">
                    <h4 style="margin: 0 0 4px 0; font-size: 0.9rem; font-weight: 700;">${p.clienteNombre}</h4>
                    <p style="margin: 0 0 4px 0; font-size: 0.8rem;">Abono: <b>$${p.monto.toLocaleString()} COP</b></p>
                    <p style="margin: 0 0 2px 0; font-size: 0.7rem; color: #555;">${p.fecha.split('T')[0]}</p>
                    <span style="font-size: 0.7rem; color: #888; text-transform: uppercase;">Cobró: ${p.cobrador}</span>
                  </div>
                `);
            }
          });
        }

        // Dibujar ubicaciones en tiempo real de los cobradores (si el filtro es 'both' o 'collectors')
        if (adminMapFilter === 'both' || adminMapFilter === 'collectors') {
          cobradoresUbicaciones.forEach(c => {
            if (c.lat && c.lng) {
              const motoIcon = L.divIcon({
                className: 'custom-div-icon',
                html: `<div style="background-color: #3b82f6; width: 16px; height: 16px; border-radius: 50%; border: 2.5px solid white; box-shadow: 0 0 12px #3b82f6; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 8px;">M</div>`,
                iconSize: [16, 16]
              });

              L.marker([c.lat, c.lng], { icon: motoIcon })
                .addTo(map)
                .bindPopup(`
                  <div style="font-family: 'Outfit', sans-serif; color: #111; min-width: 140px;">
                    <h4 style="margin: 0 0 4px 0; font-size: 0.9rem; font-weight: 700; color: #3b82f6;">🛵 Cobrador Activo</h4>
                    <p style="margin: 0 0 2px 0; font-size: 0.85rem; font-weight: 600;">${c.nombre}</p>
                    <p style="margin: 0 0 2px 0; font-size: 0.75rem; color: #555;">${c.email}</p>
                    <span style="font-size: 0.65rem; color: #94a3b8;">Último reporte: ${c.ultimaUbicacion ? c.ultimaUbicacion.split('T')[1]?.split('.')[0] || c.ultimaUbicacion : 'Reciente'}</span>
                  </div>
                `);
            }
          });
        }
      } else {
        const myPayments = todayPayments.filter(p => p.cobrador === user?.nombre);
        myPayments.forEach(p => {
          if (p.lat && p.lng) {
            const greenIcon = L.divIcon({
              className: 'custom-div-icon',
              html: `<div style="background-color: var(--color-success); width: 14px; height: 14px; border-radius: 50%; border: 2.5px solid white; box-shadow: 0 0 10px var(--color-success);"></div>`,
              iconSize: [14, 14]
            });
            L.marker([p.lat, p.lng], { icon: greenIcon })
              .addTo(map)
              .bindPopup(`<b>${p.clienteNombre}</b><br/>Abonado hoy: $${p.monto.toLocaleString()} COP`);
          }
        });

        if (pendingCredits.length > 0) {
          const nextClient = pendingCredits[0];
          const lastPayment = pagos.find(p => p.clienteNombre === nextClient.clienteNombre && p.lat && p.lng);
          const clientLat = lastPayment ? lastPayment.lat : (10.411320 + (nextClient.id * 0.0018));
          const clientLng = lastPayment ? lastPayment.lng : (-75.289210 - (nextClient.id * 0.0018));

          const orangeIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="background-color: var(--color-warning); width: 18px; height: 18px; border-radius: 50%; border: 2.5px solid white; box-shadow: 0 0 12px var(--color-warning); animation: pulse-slow 1.5s infinite ease-in-out;"></div>`,
            iconSize: [18, 18]
          });

          L.marker([clientLat, clientLng], { icon: orangeIcon })
            .addTo(map)
            .bindPopup(`
              <div style="font-family: 'Outfit', sans-serif; color: #111; min-width: 150px;">
                <h4 style="margin: 0 0 4px 0; font-size: 0.95rem; font-weight: 700; color: var(--color-warning);">👉 Siguiente Cliente</h4>
                <p style="margin: 0 0 2px 0; font-size: 0.9rem; font-weight: 600;">${nextClient.clienteNombre}</p>
                <p style="margin: 0 0 4px 0; font-size: 0.8rem; color: #555;">Monto a cobrar: <b>$${nextClient.valorCuota.toLocaleString()} COP</b></p>
                <span style="font-size: 0.75rem; color: #888;">Dir: ${clientes.find(c => c.documento === nextClient.documento)?.direccion || 'No disponible'}</span>
              </div>
            `)
            .openPopup();
        }
      }

      return () => {
        map.remove();
      };
    }
  }, [activeTab, pagos, pendingCredits, token, user, clientes, cobradoresUbicaciones, adminMapFilter]);

  // Amortization Calculations
  const calculateTotalAPagar = (monto: number, tasa: number) => {
    return Number(monto) + (Number(monto) * (Number(tasa) / 100));
  };

  const calculateCuota = (monto: number, tasa: number, numCuotas: number) => {
    const total = calculateTotalAPagar(monto, tasa);
    return Math.round(total / numCuotas);
  };

  // API Form Handlers
  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClient.documento || !newClient.nombre || !newClient.telefono || !newClient.direccion || !newClient.rutaId) {
      alert('Todos los campos son obligatorios.');
      return;
    }
    try {
      const res = await fetchWithAuth(`${API_URL}/clientes`, {
        method: 'POST',
        body: JSON.stringify({
          documento: newClient.documento,
          nombre: newClient.nombre,
          telefono: newClient.telefono,
          direccion: newClient.direccion,
          rutaId: Number(newClient.rutaId)
        })
      });
      if (res.ok) {
        setNewClient({ documento: '', nombre: '', telefono: '', direccion: '', rutaId: rutas[0]?.id.toString() || '' });
        loadAppData();
      } else {
        const data = await res.json();
        alert(data.message || 'Error al registrar cliente.');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;
    try {
      const res = await fetchWithAuth(`${API_URL}/clientes/${editingClient.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          documento: editingClient.documento,
          nombre: editingClient.nombre,
          telefono: editingClient.telefono,
          direccion: editingClient.direccion,
          rutaId: Number(editingClient.rutaId)
        })
      });
      if (res.ok) {
        setEditingClient(null);
        loadAppData();
      } else {
        const data = await res.json();
        alert(data.message || 'Error al actualizar cliente.');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteClient = async (id: number) => {
    if (!window.confirm('¿Seguro que desea eliminar este cliente?')) return;
    try {
      const res = await fetchWithAuth(`${API_URL}/clientes/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        loadAppData();
      } else {
        const data = await res.json();
        alert(data.message || 'Error al eliminar cliente. Verifique que no tenga créditos asociados.');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleAddCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCredit.clienteId || !newCredit.monto || !newCredit.tasa || !newCredit.cuotas) {
      alert('Todos los campos son obligatorios.');
      return;
    }
    try {
      const res = await fetchWithAuth(`${API_URL}/creditos`, {
        method: 'POST',
        body: JSON.stringify({
          clienteId: Number(newCredit.clienteId),
          monto: Number(newCredit.monto),
          tasa: Number(newCredit.tasa),
          frecuencia: newCredit.frecuencia,
          cuotas: Number(newCredit.cuotas)
        })
      });
      if (res.ok) {
        loadAppData();
      } else {
        const data = await res.json();
        alert(data.message || 'Error al desembolsar crédito.');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleUpdateCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCredit) return;
    try {
      const res = await fetchWithAuth(`${API_URL}/creditos/${editingCredit.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          monto: Number(editingCredit.monto),
          tasa: Number(editingCredit.interes),
          saldoPendiente: Number(editingCredit.saldoPendiente),
          estado: editingCredit.estado,
          frecuencia: editingCredit.frecuencia
        })
      });
      if (res.ok) {
        setEditingCredit(null);
        loadAppData();
      } else {
        const data = await res.json();
        alert(data.message || 'Error al actualizar crédito.');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteCredit = async (id: number) => {
    if (!window.confirm('¿Seguro que desea eliminar este crédito?')) return;
    try {
      const res = await fetchWithAuth(`${API_URL}/creditos/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        loadAppData();
      } else {
        const data = await res.json();
        alert(data.message || 'Error al eliminar crédito. Verifique que no tenga pagos asociados.');
      }
    } catch (error) {
      console.error(error);
    }
  };



  const handleCreateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoute.nombre_ruta) return alert('El nombre de la ruta es obligatorio.');
    try {
      const res = await fetchWithAuth(`${API_URL}/rutas`, {
        method: 'POST',
        body: JSON.stringify({
          nombre_ruta: newRoute.nombre_ruta,
          id_cobrador: newRoute.id_cobrador ? Number(newRoute.id_cobrador) : null
        })
      });
      if (res.ok) {
        alert('Ruta creada exitosamente.');
        setNewRoute({ nombre_ruta: '', id_cobrador: '' });
        loadAppData();
      } else {
        const data = res.headers.get('content-type')?.includes('application/json') ? await res.json() : null;
        alert(data?.message || 'Error al crear la ruta.');
      }
    } catch (error) {
      console.error(error);
      alert('Error de conexión.');
    }
  };

  const handleUpdateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoute || !editingRoute.nombre_ruta) return alert('El nombre de la ruta es obligatorio.');
    try {
      const res = await fetchWithAuth(`${API_URL}/rutas/${editingRoute.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          nombre_ruta: editingRoute.nombre_ruta,
          id_cobrador: editingRoute.id_cobrador ? Number(editingRoute.id_cobrador) : null
        })
      });
      if (res.ok) {
        alert('Ruta actualizada exitosamente.');
        setEditingRoute(null);
        loadAppData();
      } else {
        const data = res.headers.get('content-type')?.includes('application/json') ? await res.json() : null;
        alert(data?.message || 'Error al actualizar la ruta.');
      }
    } catch (error) {
      console.error(error);
      alert('Error de conexión.');
    }
  };

  const handleDeleteRoute = async (id: number) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta ruta?')) return;
    try {
      const res = await fetchWithAuth(`${API_URL}/rutas/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        alert('Ruta eliminada exitosamente.');
        loadAppData();
      } else {
        const data = res.headers.get('content-type')?.includes('application/json') ? await res.json() : null;
        alert(data?.message || 'Error al eliminar la ruta.');
      }
    } catch (error) {
      console.error(error);
      alert('Error de conexión.');
    }
  };

  const handleAddGasto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGasto.descripcion || !newGasto.monto) {
      alert('Por favor llene todos los campos.');
      return;
    }
    try {
      const res = await fetchWithAuth(`${API_URL}/gastos`, {
        method: 'POST',
        body: JSON.stringify({
          descripcion: newGasto.descripcion,
          monto: Number(newGasto.monto)
        })
      });
      if (res.ok) {
        setNewGasto({ descripcion: '', monto: '' });
        loadAppData();
      } else {
        const data = await res.json();
        alert(data.message || 'Error al registrar gasto.');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteGasto = async (id: number) => {
    if (!window.confirm('¿Seguro que desea eliminar este gasto?')) return;
    try {
      const res = await fetchWithAuth(`${API_URL}/gastos/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        loadAppData();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPayment.creditoId || !newPayment.monto) {
      alert('Todos los campos son obligatorios.');
      return;
    }
    
    const creditIdNum = Number(newPayment.creditoId);
    const montoNum = Number(newPayment.monto);
    const creditObj = creditos.find(c => c.id === creditIdNum);
    const clientObj = clientes.find(cl => cl.id === creditObj?.clienteId || cl.nombre === creditObj?.clienteNombre);
    
    if (!apiOnline) {
      const tempPaymentId = Date.now();
      const offlinePay = {
        id: tempPaymentId,
        creditoId: creditIdNum,
        clienteNombre: creditObj?.clienteNombre || 'Cliente Offline',
        clienteTelefono: clientObj?.telefono || '',
        monto: montoNum,
        tipo: newPayment.tipo,
        fecha: new Date().toISOString(),
        cobrador: user?.nombre || 'Cobrador Offline',
        lat: newPayment.lat ? parseFloat(newPayment.lat) : null,
        lng: newPayment.lng ? parseFloat(newPayment.lng) : null,
        isOffline: true
      };
      
      const updatedQueue = [...offlinePayments, offlinePay];
      setOfflinePayments(updatedQueue);
      localStorage.setItem('zenu_offline_payments', JSON.stringify(updatedQueue));
      
      if (creditObj) {
        const nuevoSaldo = Math.max(0, creditObj.saldoPendiente - montoNum);
        const nuevoEstado = nuevoSaldo <= 0 ? 'PAGADO' : 'ACTIVO';
        
        setCreditos(prev => prev.map(c => c.id === creditIdNum ? {
          ...c,
          saldoPendiente: nuevoSaldo,
          pagado: c.totalAPagar - nuevoSaldo,
          estado: nuevoEstado
        } : c));
        
        const receipt = {
          id: tempPaymentId,
          clienteNombre: creditObj.clienteNombre,
          clienteTelefono: clientObj?.telefono || '',
          monto: montoNum,
          tipo: newPayment.tipo,
          fecha: offlinePay.fecha,
          cobrador: offlinePay.cobrador,
          saldoPendiente: nuevoSaldo,
          estadoCredito: nuevoEstado,
          isOffline: true
        };
        
        setReceiptData(receipt);
        setShowReceiptModal(true);
      }
      
      setNewPayment(prev => ({ ...prev, monto: '' }));
      alert('Cobrador, el pago se ha guardado en el dispositivo sin conexión y se sincronizará cuando vuelva la señal.');
      return;
    }
    
    try {
      const res = await fetchWithAuth(`${API_URL}/pagos`, {
        method: 'POST',
        body: JSON.stringify({
          creditoId: creditIdNum,
          monto: montoNum,
          tipo: newPayment.tipo,
          lat: newPayment.lat ? parseFloat(newPayment.lat) : null,
          lng: newPayment.lng ? parseFloat(newPayment.lng) : null
        })
      });
      if (res.ok) {
        const resData = await res.json();
        
        const receipt = {
          id: resData.data.pago.id_pago,
          clienteNombre: creditObj?.clienteNombre || 'Cliente',
          clienteTelefono: clientObj?.telefono || '',
          monto: resData.data.pago.monto_pagado || montoNum,
          tipo: resData.data.pago.tipo_pago || newPayment.tipo,
          fecha: resData.data.pago.fecha_hora || new Date().toISOString(),
          cobrador: user?.nombre || 'Cobrador',
          saldoPendiente: resData.data.credito.saldo_pendiente,
          estadoCredito: resData.data.credito.estado
        };
        
        setReceiptData(receipt);
        setShowReceiptModal(true);
        setNewPayment(prev => ({ ...prev, monto: '' }));
        loadAppData();
      } else {
        const data = await res.json();
        alert(data.message || 'Error al registrar pago.');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handlePreviewLiqSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!liqForm.cobradorId || !liqForm.fecha) return;
    try {
      const res = await fetchWithAuth(
        `${API_URL}/liquidaciones/previsualizar?cobradorId=${liqForm.cobradorId}&fecha=${liqForm.fecha}`
      );
      if (res.ok) {
        const data = await res.json();
        setLiqPreview(data.data);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleSaveLiq = async () => {
    if (!liqPreview || !liqForm.efectivoEntregado) {
      alert('Por favor ingrese el efectivo recibido.');
      return;
    }
    try {
      const res = await fetchWithAuth(`${API_URL}/liquidaciones`, {
        method: 'POST',
        body: JSON.stringify({
          cobradorId: liqPreview.cobradorId,
          fecha: liqPreview.fecha,
          totalRecaudado: liqPreview.totalRecaudado,
          totalGastos: liqPreview.totalGastos,
          efectivoEntregado: Number(liqForm.efectivoEntregado),
          notes: `Cierre de caja registrado por ${user?.nombre}`
        })
      });
      if (res.ok) {
        setLiqPreview(null);
        setLiqForm(prev => ({ ...prev, efectivoEntregado: '' }));
        loadAppData();
      } else {
        const data = await res.json();
        alert(data.message || 'Error al registrar liquidación.');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleApproveLiq = async (id: number) => {
    try {
      const res = await fetchWithAuth(`${API_URL}/liquidaciones/${id}/aprobar`, {
        method: 'PUT'
      });
      if (res.ok) {
        loadAppData();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleShareWhatsApp = (p: any) => {
    const formattedMonto = p.monto.toLocaleString();
    const cleanPhone = p.clienteTelefono.replace(/[^0-9]/g, '');
    const text = `*Recibo de Abono - ZENU Credits*%0A%0A` +
      `*Ref Pago:* %2300${p.id}%0A` +
      `*Cliente:* ${p.clienteNombre}%0A` +
      `*Monto Recaudado:* $${formattedMonto} COP%0A` +
      `*Tipo:* ${p.tipo}%0A` +
      `*Fecha:* ${p.fecha.split('.')[0]}%0A%0A` +
      `_¡Gracias por tu pago puntual! Tu saldo se ha actualizado en tiempo real._`;
    
    window.open(`https://api.whatsapp.com/send?phone=57${cleanPhone}&text=${text}`, '_blank');
  };

  // System Users CRUD (Solo ADMIN)
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.nombre || !newUser.email || !newUser.password || !newUser.rol) {
      alert('Todos los campos son obligatorios.');
      return;
    }
    try {
      const res = await fetchWithAuth(`${API_URL}/usuarios`, {
        method: 'POST',
        body: JSON.stringify(newUser)
      });
      if (res.ok) {
        setNewUser({ nombre: '', email: '', password: '', rol: 'COBRADOR' });
        loadAppData();
      } else {
        const data = await res.json();
        alert(data.message || 'Error al crear usuario.');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      const res = await fetchWithAuth(`${API_URL}/usuarios/${editingUser.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          nombre: editingUser.nombre,
          email: editingUser.email,
          rol: editingUser.rol,
          estado: editingUser.estado,
          password: editingUser.password || undefined
        })
      });
      if (res.ok) {
        setEditingUser(null);
        loadAppData();
      } else {
        const data = await res.json();
        alert(data.message || 'Error al actualizar usuario.');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!window.confirm('¿Seguro que desea eliminar este usuario del sistema?')) return;
    try {
      const res = await fetchWithAuth(`${API_URL}/usuarios/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        loadAppData();
      } else {
        const data = await res.json();
        alert(data.message || 'Error al eliminar usuario.');
      }
    } catch (error) {
      console.error(error);
    }
  };

  // Render Login view if not authenticated
  if (!token) {
    return (
      <div className="login-container">
        <form className="login-card" onSubmit={handleLoginSubmit}>
          <div className="login-logo">
            <div className="login-logo-icon">Z</div>
            <h1 className="login-title">Zenu Credits</h1>
            <p className="login-subtitle">Inicie sesión para acceder al sistema</p>
          </div>

          {loginError && (
            <div className="login-error">
              <AlertTriangle size={18} />
              <span>{loginError}</span>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="loginEmail">Correo Electrónico</label>
            <input
              id="loginEmail"
              type="email"
              className="form-control"
              placeholder="ejemplo@zenu.com"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="loginPassword">Contraseña</label>
            <input
              id="loginPassword"
              type="password"
              className="form-control"
              placeholder="••••••••"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>
            Iniciar Sesión
          </button>
        </form>
      </div>
    );
  }

  const activeCredits = creditos.filter((c: any) => c.estado !== 'PAGADO');

  return (
    <div className="app-container">
      {/* Mobile Top Header */}
      <div className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="logo-icon" style={{ width: '32px', height: '32px', fontSize: '1rem', borderRadius: '6px' }}>Z</div>
          <span style={{ fontWeight: 700, fontSize: '1.1rem', letterSpacing: '-0.3px' }}>Credits</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="badge badge-neutral" style={{ padding: '4px 8px', fontSize: '0.7rem' }}>
            {user?.rol === 'ADMIN' ? 'Admin' : 'Cobrador'}
          </span>
          <button className="logout-btn" onClick={() => setActiveTab('configuraciones')} style={{ margin: 0, padding: 0, background: 'none', border: 'none' }}>
            <Settings size={18} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>
      </div>

      {/* Desktop Sidebar Navigation */}
      <aside className="sidebar">
        <div className="logo-container">
          <div className="logo-icon shadow-glow-emerald">Z</div>
          <div className="logo-text">
            <span>ZENU</span>
            <span style={{ fontSize: '0.65rem', display: 'block', color: 'var(--color-primary)', fontWeight: 600, letterSpacing: '1px', marginTop: '-4px' }}>FINTECH PRO</span>
          </div>
        </div>

        <ul className="nav-menu">
          <li>
            <button
              className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <LayoutDashboard className="nav-icon" />
              <span>Dashboard</span>
            </button>
          </li>
          
          {user?.rol === 'ADMIN' && (
            <li>
              <button
                className={`nav-item ${activeTab === 'rutas' ? 'active' : ''}`}
                onClick={() => setActiveTab('rutas')}
              >
                <MapPin className="nav-icon" />
                <span>Gestión de Rutas</span>
              </button>
            </li>
          )}

          {user?.rol === 'ADMIN' && (
            <li>
              <button
                className={`nav-item ${activeTab === 'usuarios' ? 'active' : ''}`}
                onClick={() => setActiveTab('usuarios')}
              >
                <Users className="nav-icon" />
                <span>Gestión de Usuarios</span>
              </button>
            </li>
          )}

          <li>
            <button
              className={`nav-item ${activeTab === 'clientes' ? 'active' : ''}`}
              onClick={() => setActiveTab('clientes')}
            >
              <Users className="nav-icon" />
              <span>Clientes</span>
            </button>
          </li>
          <li>
            <button
              className={`nav-item ${activeTab === 'creditos' ? 'active' : ''}`}
              onClick={() => setActiveTab('creditos')}
            >
              <CreditCard className="nav-icon" />
              <span>Créditos</span>
            </button>
          </li>
          <li>
            <button
              className={`nav-item ${activeTab === 'pagos' ? 'active' : ''}`}
              onClick={() => setActiveTab('pagos')}
            >
              <TrendingUp className="nav-icon" />
              <span>Recaudo Diario</span>
            </button>
          </li>
          <li>
            <button
              className={`nav-item ${activeTab === 'gastos' ? 'active' : ''}`}
              onClick={() => setActiveTab('gastos')}
            >
              <TrendingUp className="nav-icon" style={{ transform: 'rotate(180deg)', color: 'var(--color-danger)' }} />
              <span>Gastos de Ruta</span>
            </button>
          </li>
          {user?.rol === 'ADMIN' && (
            <li>
              <button
                className={`nav-item ${activeTab === 'liquidaciones' ? 'active' : ''}`}
                onClick={() => setActiveTab('liquidaciones')}
              >
                <CheckCircle2 className="nav-icon" />
                <span>Liquidación Diario</span>
              </button>
            </li>
          )}
          <li>
            <button
              className={`nav-item ${activeTab === 'configuraciones' ? 'active' : ''}`}
              onClick={() => setActiveTab('configuraciones')}
            >
              <Settings className="nav-icon" />
              <span>Configuración</span>
            </button>
          </li>
        </ul>

        <div className="sidebar-footer" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="user-avatar">{user?.nombre.charAt(0).toUpperCase()}</div>
            <div className="user-info">
              <span className="user-name">{user?.nombre}</span>
              <span className="user-role">{user?.rol === 'ADMIN' ? 'Administrador' : 'Cobrador'}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {offlinePayments.length > 0 && (
          <div className="offline-sync-bar" style={{ borderRadius: 'var(--radius-md)', marginBottom: '20px' }}>
            <span className="material-symbols-outlined spin">sync</span>
            <span>Sincronización Offline: {offlinePayments.length} abonos guardados localmente.</span>
            <button type="button" onClick={syncOfflinePayments} disabled={isSyncing} className="btn btn-sm btn-primary" style={{ marginLeft: 'auto', background: '#0b0f19', color: '#10b981', border: 'none' }}>
              {isSyncing ? 'Sincronizando...' : '🔄 Sincronizar Ahora'}
            </button>
          </div>
        )}
        <header className="header">
          <div className="welcome-section">
            <h1>Control de Operaciones Zenu</h1>
            <p>Monitoreo financiero en tiempo real • Recaudación y Rutas</p>
          </div>

          <div className="header-actions">
            {stats.totalRecaudadoHoy > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '30px', color: '#10b981', fontWeight: 700, fontSize: '0.85rem' }}>
                <DollarSign size={16} />
                <span>Recaudado Hoy: ${stats.totalRecaudadoHoy.toLocaleString()}</span>
              </div>
            )}

            <button className="btn btn-secondary btn-sm" onClick={loadAppData} disabled={loadingHealth} title="Recargar datos">
              <RefreshCw className={`nav-icon ${loadingHealth ? 'spin' : ''}`} />
            </button>

            <div className="db-status-badge shadow-glow-emerald">
              <span className={`status-dot ${apiOnline ? 'online' : 'offline'}`}></span>
              <span>
                API: {apiOnline === null ? 'Verificando...' : apiOnline ? `Online (${dbTime ? new Date(dbTime).toLocaleTimeString() : 'Postgres'})` : 'Offline'}
              </span>
            </div>
          </div>
        </header>

        {/* Dynamic Views */}
        {activeTab === 'dashboard' && (
          <>
            {/* Cards Grid - Adaptada para ADMIN y COBRADOR */}
            <div className="dashboard-grid">
              {user?.rol === 'ADMIN' ? (
                <>
                  <div className="card primary">
                    <div className="card-header-icon">
                      <span className="card-title">Capital en Calle</span>
                      <div className="card-icon-wrapper">
                        <DollarSign size={20} />
                      </div>
                    </div>
                    <div className="card-value">${stats.totalCapitalEnCalle.toLocaleString()} COP</div>
                    <div className="card-trend up">
                      <span>De ${stats.totalPrestado.toLocaleString()} desembolsados</span>
                    </div>
                  </div>

                  <div className="card success">
                    <div className="card-header-icon">
                      <span className="card-title">Recaudado Hoy</span>
                      <div className="card-icon-wrapper">
                        <TrendingUp size={20} />
                      </div>
                    </div>
                    <div className="card-value">${stats.totalRecaudadoHoy.toLocaleString()} COP</div>
                    <div className="card-trend up">
                      <span>Actualizado en tiempo real</span>
                    </div>
                  </div>

                  <div className="card warning">
                    <div className="card-header-icon">
                      <span className="card-title">Clientes Activos</span>
                      <div className="card-icon-wrapper">
                        <UserCheck size={20} />
                      </div>
                    </div>
                    <div className="card-value">{stats.clientesActivosCount}</div>
                    <div className="card-trend neutral">
                      <span>Total {stats.totalClientesCount} registrados</span>
                    </div>
                  </div>

                  <div className="card danger">
                    <div className="card-header-icon">
                      <span className="card-title">Tasa de Mora</span>
                      <div className="card-icon-wrapper">
                        <AlertTriangle size={20} />
                      </div>
                    </div>
                    <div className="card-value">{stats.moraGlobalPercent}%</div>
                    <div className="card-trend down">
                      <span>Créditos vencidos</span>
                    </div>
                  </div>
                </>
              ) : (
                // Vista de Cobrador: Solo recaudo y clientes pendientes
                <>
                  <div className="card success" style={{ gridColumn: 'span 1' }}>
                    <div className="card-header-icon">
                      <span className="card-title">Mi Recaudo de Hoy</span>
                      <div className="card-icon-wrapper">
                        <TrendingUp size={20} />
                      </div>
                    </div>
                    <div className="card-value">
                      ${todayPayments.filter(p => p.cobrador === user?.nombre).reduce((a, b) => a + b.monto, 0).toLocaleString()} COP
                    </div>
                    <div className="card-trend up">
                      <span>Cobros liquidados hoy</span>
                    </div>
                  </div>

                  <div className="card warning" style={{ gridColumn: 'span 1' }}>
                    <div className="card-header-icon">
                      <span className="card-title">Clientes Pendientes</span>
                      <div className="card-icon-wrapper">
                        <UserCheck size={20} />
                      </div>
                    </div>
                    <div className="card-value">{clientesPendientesCount}</div>
                    <div className="card-trend down" style={{ color: 'var(--color-warning)' }}>
                      <span>Por visitar en mi ruta hoy</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Split Panel */}
            <div className="section-container">
              {/* Left Column: Route status (Admin) OR Route client list (Cobrador) */}
              <div className="panel">
                {user?.rol === 'ADMIN' ? (
                  <>
                    <div className="panel-header">
                      <h2 className="panel-title">
                        <Compass size={20} className="card-title-icon" style={{ color: 'var(--color-primary)' }} />
                        Estado de Rutas Diarias
                      </h2>
                    </div>
                    <div>
                      {rutas.map(ruta => (
                        <div className="route-card" key={ruta.id}>
                          <div className="route-header">
                            <span className="route-name">{ruta.nombre_ruta}</span>
                            <span className="badge badge-neutral">{ruta.cobrador}</span>
                          </div>
                          <div className="progress-bar-container">
                            <div
                              className="progress-bar"
                              style={{
                                width: `${ruta.progress}%`,
                                backgroundColor: ruta.progress > 50 ? 'var(--color-success)' : 'var(--color-warning)'
                              }}
                            ></div>
                          </div>
                          <div className="route-stats">
                            <span>Recaudado: ${ruta.recaudado.toLocaleString()} COP</span>
                            <span>Esperado: ${ruta.totalEsperado.toLocaleString()} COP</span>
                            <span>Progreso: {ruta.progress}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  // Cobrador: Listado de cobro de clientes de su ruta
                  <>
                    <div className="panel-header">
                      <h2 className="panel-title">
                        <Compass size={20} className="card-title-icon" style={{ color: 'var(--color-primary)' }} />
                        Hojas de Cobro: {cobradorRoute?.nombre_ruta || 'Sin Ruta Asignada'}
                      </h2>
                    </div>
                    <div className="table-wrapper">
                      <table className="custom-table">
                        <thead>
                          <tr>
                            <th>Cliente</th>
                            <th>Dirección de Visita</th>
                            <th>Valor a Cobrar</th>
                            <th>Estado de Pago</th>
                          </tr>
                        </thead>
                        <tbody>
                          {routeCredits.map(cr => {
                            const hasPaid = paidTodayNames.includes(cr.clienteNombre);
                            return (
                              <tr key={cr.id}>
                                <td style={{ fontWeight: 600 }}>{cr.clienteNombre}</td>
                                <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                  {clientes.find(c => c.documento === cr.documento)?.direccion || 'No registrada'}
                                </td>
                                <td style={{ fontWeight: 700, color: 'var(--color-success)' }}>
                                  ${cr.valorCuota.toLocaleString()} COP
                                </td>
                                <td>
                                  <span className={`badge ${hasPaid ? 'badge-success' : 'badge-warning'}`}>
                                    {hasPaid ? 'Cobrado' : 'Pendiente'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                          {routeCredits.length === 0 && (
                            <tr>
                              <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                                No tienes clientes con créditos activos asignados a tu ruta.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>

              {/* Right Column: Live GPS Coordinates Map */}
              <div className="panel">
                <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <h2 className="panel-title">
                    <MapPin size={20} style={{ color: 'var(--color-danger)' }} />
                    Geolocalización en Vivo
                  </h2>
                  {user?.rol === 'ADMIN' && (
                    <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-card-hover)', padding: '2px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <button 
                        type="button"
                        onClick={() => setAdminMapFilter('both')}
                        className={`btn-filter ${adminMapFilter === 'both' ? 'active' : ''}`}
                        style={{
                          background: adminMapFilter === 'both' ? 'var(--color-primary)' : 'transparent',
                          color: adminMapFilter === 'both' ? 'white' : 'var(--text-secondary)',
                          border: 'none', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s'
                        }}
                      >
                        Ambos
                      </button>
                      <button 
                        type="button"
                        onClick={() => setAdminMapFilter('clients')}
                        className={`btn-filter ${adminMapFilter === 'clients' ? 'active' : ''}`}
                        style={{
                          background: adminMapFilter === 'clients' ? 'var(--color-primary)' : 'transparent',
                          color: adminMapFilter === 'clients' ? 'white' : 'var(--text-secondary)',
                          border: 'none', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s'
                        }}
                      >
                        Clientes
                      </button>
                      <button 
                        type="button"
                        onClick={() => setAdminMapFilter('collectors')}
                        className={`btn-filter ${adminMapFilter === 'collectors' ? 'active' : ''}`}
                        style={{
                          background: adminMapFilter === 'collectors' ? 'var(--color-primary)' : 'transparent',
                          color: adminMapFilter === 'collectors' ? 'white' : 'var(--text-secondary)',
                          border: 'none', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s'
                        }}
                      >
                        Cobradores
                      </button>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div 
                    ref={mapContainerRef} 
                    className="map-element-container"
                    style={{ height: user?.rol === 'COBRADOR' ? '200px' : '450px' }}
                  ></div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {user?.rol === 'ADMIN' ? 'Últimos Puntos Registrados:' : 'Siguiente Cliente en la Lista:'}
                    </span>
                    {user?.rol === 'ADMIN' ? (
                      pagos.filter(p => p.lat && p.lng).slice(0, 3).map(p => (
                        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.clienteNombre}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              Dir: {clientes.find(c => c.nombre === p.clienteNombre)?.direccion || 'No disponible'}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{p.fecha.split('T')[0] || p.fecha}</span>
                          </div>
                          <a 
                            href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary btn-sm"
                            style={{ 
                              fontSize: '0.75rem', padding: '4px 8px', borderRadius: '6px', 
                              textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px',
                              background: 'rgba(99, 102, 241, 0.1)', color: 'var(--color-primary)', border: '1px solid rgba(99, 102, 241, 0.2)',
                              fontWeight: 600
                            }}
                          >
                            📍 Cómo llegar
                          </a>
                        </div>
                      ))
                    ) : (
                      pendingCredits.length > 0 ? (
                        <div style={{ padding: '12px', backgroundColor: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.15)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontWeight: 700, color: 'var(--color-warning)', fontSize: '0.9rem' }}>
                            {pendingCredits[0].clienteNombre}
                          </span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            Dirección: {clientes.find(c => c.documento === pendingCredits[0].documento)?.direccion || 'No disponible'}
                          </span>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                            Cuota a Cobrar: ${pendingCredits[0].valorCuota.toLocaleString()} COP
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-success)', fontWeight: 600 }}>
                          🎉 ¡Felicidades! Completaste todos los cobros de tu ruta hoy.
                        </span>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'rutas' && user?.rol === 'ADMIN' && (
          <>
            <button 
              type="button" 
              className="btn btn-secondary btn-sm mobile-only" 
              onClick={() => setActiveTab('configuraciones')}
              style={{ marginBottom: '15px' }}
            >
              ← Volver a Ajustes
            </button>
            <div className="section-container" style={{ gridTemplateColumns: '1fr 2fr' }}>
              <div className="panel">
                <div className="panel-header">
                  <h2 className="panel-title">
                    {editingRoute ? 'Editar Ruta' : 'Nueva Ruta'}
                  </h2>
                  {editingRoute && (
                    <button 
                      type="button" 
                      className="btn btn-secondary btn-sm" 
                      onClick={() => setEditingRoute(null)}
                      style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                    >
                      Cancelar
                    </button>
                  )}
                </div>
                <form onSubmit={editingRoute ? handleUpdateRoute : handleCreateRoute}>
                  <div className="form-group">
                    <label htmlFor="routeNameInput">Nombre de la Ruta</label>
                    <input
                      id="routeNameInput"
                      type="text"
                      className="form-control"
                      placeholder="Ej. Ruta Sur - El Recreo"
                      value={editingRoute ? editingRoute.nombre_ruta : newRoute.nombre_ruta}
                      onChange={(e) => {
                        if (editingRoute) {
                          setEditingRoute({ ...editingRoute, nombre_ruta: e.target.value });
                        } else {
                          setNewRoute({ ...newRoute, nombre_ruta: e.target.value });
                        }
                      }}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="routeCobradorSelect">Cobrador Asignado</label>
                    <select
                      id="routeCobradorSelect"
                      className="form-control"
                      value={editingRoute ? (editingRoute.id_cobrador || '') : newRoute.id_cobrador}
                      onChange={(e) => {
                        if (editingRoute) {
                          setEditingRoute({ ...editingRoute, id_cobrador: e.target.value ? Number(e.target.value) : null });
                        } else {
                          setNewRoute({ ...newRoute, id_cobrador: e.target.value });
                        }
                      }}
                    >
                      <option value="">Sin Asignar</option>
                      {cobradoresList.map(c => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </select>
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '12px' }}>
                    {editingRoute ? 'Guardar Cambios' : 'Crear Ruta'}
                  </button>
                </form>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <h2 className="panel-title">Rutas Registradas</h2>
                </div>
                <div className="table-wrapper">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Ruta</th>
                        <th>Cobrador</th>
                        <th>Recaudado</th>
                        <th>Esperado</th>
                        <th>Estado</th>
                        <th style={{ textAlign: 'center' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rutas.map(r => (
                        <tr key={r.id}>
                          <td data-label="Ruta" style={{ fontWeight: 600 }}>{r.nombre_ruta}</td>
                          <td data-label="Cobrador">{r.cobrador}</td>
                          <td data-label="Recaudado Hoy" style={{ color: 'var(--color-success)' }}>${r.recaudado.toLocaleString()}</td>
                          <td data-label="Esperado Diario">${r.totalEsperado.toLocaleString()}</td>
                          <td data-label="Estado">
                            <span className={`badge ${r.cobradorId ? 'badge-success' : 'badge-warning'}`}>
                              {r.cobradorId ? 'Activa' : 'Sin Cobrador'}
                            </span>
                          </td>
                          <td data-label="Acciones" style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '4px 8px', fontSize: '0.75rem', fontWeight: 600 }}
                              onClick={() => setEditingRoute({ id: r.id, nombre_ruta: r.nombre_ruta, id_cobrador: r.cobradorId })}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '4px 8px', fontSize: '0.75rem', borderColor: 'var(--color-danger)', color: 'var(--color-danger)', fontWeight: 600 }}
                              onClick={() => handleDeleteRoute(r.id)}
                            >
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))}
                      {rutas.length === 0 && (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                            No hay rutas registradas.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'usuarios' && user?.rol === 'ADMIN' && (
          <>
            <button 
              type="button" 
              className="btn btn-secondary btn-sm mobile-only" 
              onClick={() => setActiveTab('configuraciones')}
              style={{ marginBottom: '15px' }}
            >
              ← Volver a Ajustes
            </button>
            <div className="section-container" style={{ gridTemplateColumns: '1fr 2fr' }}>
            <div className="panel">
              <div className="panel-header">
                <h2 className="panel-title">
                  {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
                </h2>
                {editingUser && (
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditingUser(null)}>
                    <X size={14} /> Cancelar
                  </button>
                )}
              </div>
              <form onSubmit={editingUser ? handleUpdateUser : handleAddUser}>
                <div className="form-group">
                  <label>Nombre Completo</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Ej. Pedro Picapiedra"
                    value={editingUser ? editingUser.nombre : newUser.nombre}
                    onChange={(e) => editingUser 
                      ? setEditingUser({ ...editingUser, nombre: e.target.value })
                      : setNewUser({ ...newUser, nombre: e.target.value })
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Correo Electrónico</label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="ejemplo@zenu.com"
                    value={editingUser ? editingUser.email : newUser.email}
                    onChange={(e) => editingUser
                      ? setEditingUser({ ...editingUser, email: e.target.value })
                      : setNewUser({ ...newUser, email: e.target.value })
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Contraseña {editingUser && '(Dejar en blanco para mantener actual)'}</label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="••••••••"
                    value={editingUser ? (editingUser.password || '') : newUser.password}
                    onChange={(e) => editingUser
                      ? setEditingUser({ ...editingUser, password: e.target.value })
                      : setNewUser({ ...newUser, password: e.target.value })
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Rol de Usuario</label>
                  <select
                    className="form-control"
                    value={editingUser ? editingUser.rol : newUser.rol}
                    onChange={(e) => editingUser
                      ? setEditingUser({ ...editingUser, rol: e.target.value })
                      : setNewUser({ ...newUser, rol: e.target.value })
                    }
                  >
                    <option value="COBRADOR">Cobrador</option>
                    <option value="ADMIN">Administrador</option>
                  </select>
                </div>

                {editingUser && (
                  <div className="form-group">
                    <label>Estado</label>
                    <select
                      className="form-control"
                      value={editingUser.estado ? 'true' : 'false'}
                      onChange={(e) => setEditingUser({ ...editingUser, estado: e.target.value === 'true' })}
                    >
                      <option value="true">Activo</option>
                      <option value="false">Inactivo</option>
                    </select>
                  </div>
                )}

                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '12px' }}>
                  {editingUser ? 'Actualizar Usuario' : 'Registrar Usuario'}
                </button>
              </form>
            </div>

            <div className="panel">
              <div className="panel-header">
                <h2 className="panel-title">Usuarios del Sistema ({usuariosList.length})</h2>
              </div>
              <div className="table-wrapper">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Email</th>
                      <th>Rol</th>
                      <th>Estado</th>
                      <th>Fecha Registro</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuariosList.map(u => (
                      <tr key={u.id}>
                        <td data-label="Nombre" style={{ fontWeight: 600 }}>{u.nombre}</td>
                        <td data-label="Email">{u.email}</td>
                        <td data-label="Rol">
                          <span className={`badge ${u.rol === 'ADMIN' ? 'badge-primary' : 'badge-neutral'}`}>
                            {u.rol}
                          </span>
                        </td>
                        <td data-label="Estado">
                          <span className={`badge ${u.estado ? 'badge-success' : 'badge-danger'}`}>
                            {u.estado ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td data-label="Registro">{u.fechaCreacion.split(' ')[0]}</td>
                        <td data-label="Acciones">
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                setEditingUser({ ...u, password: '' });
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                            >
                              Editar
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ color: 'var(--color-danger)' }}
                              onClick={() => handleDeleteUser(u.id)}
                              disabled={user?.id_usuario === u.id}
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          </>
        )}

        {activeTab === 'clientes' && (
          <div className="section-container" style={{ gridTemplateColumns: '1fr 2fr' }}>
            <div className="panel">
              <div className="panel-header">
                <h2 className="panel-title">
                  {editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}
                </h2>
                {editingClient && (
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditingClient(null)}>
                    <X size={14} /> Cancelar
                  </button>
                )}
              </div>
              <form onSubmit={editingClient ? handleUpdateClient : handleAddClient}>
                <div className="form-group">
                  <label htmlFor="docInput">Documento de Identidad</label>
                  <input
                    id="docInput"
                    type="text"
                    className="form-control"
                    placeholder="Ej. 1045234567"
                    value={editingClient ? editingClient.documento : newClient.documento}
                    onChange={(e) => editingClient
                      ? setEditingClient({ ...editingClient, documento: e.target.value })
                      : setNewClient({ ...newClient, documento: e.target.value })
                    }
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="nombreInput">Nombre Completo</label>
                  <input
                    id="nombreInput"
                    type="text"
                    className="form-control"
                    placeholder="Ej. Juan Pérez"
                    value={editingClient ? editingClient.nombre : newClient.nombre}
                    onChange={(e) => editingClient
                      ? setEditingClient({ ...editingClient, nombre: e.target.value })
                      : setNewClient({ ...newClient, nombre: e.target.value })
                    }
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="telInput">Teléfono</label>
                  <input
                    id="telInput"
                    type="text"
                    className="form-control"
                    placeholder="Ej. 3001234567"
                    value={editingClient ? editingClient.telefono : newClient.telefono}
                    onChange={(e) => editingClient
                      ? setEditingClient({ ...editingClient, telefono: e.target.value })
                      : setNewClient({ ...newClient, telefono: e.target.value })
                    }
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="dirInput">Dirección de Residencia</label>
                  <input
                    id="dirInput"
                    type="text"
                    className="form-control"
                    placeholder="Ej. Calle 10 #20-30"
                    value={editingClient ? editingClient.direccion : newClient.direccion}
                    onChange={(e) => editingClient
                      ? setEditingClient({ ...editingClient, direccion: e.target.value })
                      : setNewClient({ ...newClient, direccion: e.target.value })
                    }
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="rutaSelectClient">Ruta Asociada</label>
                  <select
                    id="rutaSelectClient"
                    className="form-control"
                    value={editingClient ? editingClient.rutaId : newClient.rutaId}
                    onChange={(e) => editingClient
                      ? setEditingClient({ ...editingClient, rutaId: e.target.value })
                      : setNewClient({ ...newClient, rutaId: e.target.value })
                    }
                  >
                    <option value="">Seleccione una ruta</option>
                    {rutas.map(r => (
                      <option key={r.id} value={r.id}>{r.nombre_ruta}</option>
                    ))}
                  </select>
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '12px' }}>
                  {editingClient ? 'Actualizar Cliente' : 'Registrar Cliente'}
                </button>
              </form>
            </div>

            <div className="panel">
              <div className="panel-header">
                <h2 className="panel-title">Base de Clientes ({clientes.length})</h2>
                {user?.rol === 'ADMIN' && (
                  <button 
                    type="button"
                    className="btn-export"
                    onClick={() => {
                      const headers = ["ID Cliente", "Documento", "Nombre", "Telefono", "Direccion", "Ruta Asociada"];
                      const dataToExport = clientes.map(c => [
                        c.id,
                        c.documento,
                        c.nombre,
                        c.telefono,
                        c.direccion,
                        c.rutaNombre || `Ruta ${c.rutaId}`
                      ]);
                      exportToCSV(dataToExport, `Zenu_Clientes_${new Date().toISOString().split('T')[0]}`, headers);
                    }}
                  >
                    <FileDown size={14} /> Exportar a Excel
                  </button>
                )}
              </div>
              <div className="table-wrapper">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Documento</th>
                      <th>Nombre</th>
                      <th>Teléfono</th>
                      <th>Dirección</th>
                      <th>Ruta</th>
                      {user?.rol === 'ADMIN' && <th>Acciones</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {clientes.map(c => (
                      <tr key={c.id}>
                        <td data-label="Documento" style={{ fontFamily: 'monospace' }}>{c.documento}</td>
                        <td data-label="Nombre" className="allow-wrap" style={{ fontWeight: 600 }}>{c.nombre}</td>
                        <td data-label="Teléfono">{c.telefono}</td>
                        <td data-label="Dirección" className="allow-wrap">{c.direccion}</td>
                        <td data-label="Ruta">
                          <span className="badge badge-neutral">{c.rutaNombre}</span>
                        </td>
                        {user?.rol === 'ADMIN' && (
                          <td data-label="Acciones">
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => {
                                  setEditingClient(c);
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                              >
                                Editar
                              </button>
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ color: 'var(--color-danger)' }}
                                onClick={() => handleDeleteClient(c.id)}
                              >
                                Eliminar
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'creditos' && (
          <div className="section-container" style={{ gridTemplateColumns: '1fr 2fr' }}>
            <div className="panel">
              <div className="panel-header">
                <h2 className="panel-title">
                  {editingCredit ? 'Editar Crédito' : 'Nuevo Préstamo'}
                </h2>
                {editingCredit && (
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditingCredit(null)}>
                    <X size={14} /> Cancelar
                  </button>
                )}
              </div>
              <form onSubmit={editingCredit ? handleUpdateCredit : handleAddCredit}>
                {!editingCredit ? (
                  <>
                    <div className="form-group">
                      <label htmlFor="clienteSelect">Seleccionar Cliente</label>
                      <select
                        id="clienteSelect"
                        className="form-control"
                        value={newCredit.clienteId}
                        onChange={(e) => setNewCredit({ ...newCredit, clienteId: e.target.value })}
                      >
                        <option value="">Seleccione un cliente</option>
                        {clientes.map(c => (
                          <option key={c.id} value={c.id}>{c.nombre} ({c.documento})</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="montoInput">Monto a Prestar ($)</label>
                      <input
                        id="montoInput"
                        type="number"
                        className="form-control"
                        value={newCredit.monto}
                        onChange={(e) => setNewCredit({ ...newCredit, monto: Number(e.target.value) })}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="tasaInput">Tasa de Interés (%)</label>
                      <input
                        id="tasaInput"
                        type="number"
                        className="form-control"
                        value={newCredit.tasa}
                        onChange={(e) => setNewCredit({ ...newCredit, tasa: Number(e.target.value) })}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="cuotasInput">Número de Cuotas</label>
                      <input
                        id="cuotasInput"
                        type="number"
                        className="form-control"
                        value={newCredit.cuotas}
                        onChange={(e) => setNewCredit({ ...newCredit, cuotas: Number(e.target.value) })}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="frecInput">Frecuencia</label>
                      <select
                        id="frecInput"
                        className="form-control"
                        value={newCredit.frecuencia}
                        onChange={(e) => setNewCredit({ ...newCredit, frecuencia: e.target.value })}
                      >
                        <option value="DIARIO">Diario</option>
                        <option value="SEMANAL">Semanal</option>
                        <option value="QUINCENAL">Quincenal</option>
                        <option value="MENSUAL">Mensual</option>
                      </select>
                    </div>

                    {/* Live Preview Card */}
                    <div className="live-preview-card" style={{
                      padding: '12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px dashed var(--border-color)',
                      marginTop: '12px',
                      fontSize: '0.85rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Total a Pagar:</span>
                        <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                          ${calculateTotalAPagar(newCredit.monto, newCredit.tasa).toLocaleString()} COP
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Valor de Cuota:</span>
                        <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>
                          ${calculateCuota(newCredit.monto, newCredit.tasa, newCredit.cuotas).toLocaleString()} COP
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="form-group">
                      <label>Monto Prestado ($)</label>
                      <input
                        type="number"
                        className="form-control"
                        value={editingCredit.monto}
                        onChange={(e) => setEditingCredit({ ...editingCredit, monto: Number(e.target.value) })}
                      />
                    </div>

                    <div className="form-group">
                      <label>Tasa de Interés (%)</label>
                      <input
                        type="number"
                        className="form-control"
                        value={editingCredit.interes}
                        onChange={(e) => setEditingCredit({ ...editingCredit, interes: Number(e.target.value) })}
                      />
                    </div>

                    <div className="form-group">
                      <label>Saldo Pendiente ($)</label>
                      <input
                        type="number"
                        className="form-control"
                        value={editingCredit.saldoPendiente}
                        onChange={(e) => setEditingCredit({ ...editingCredit, saldoPendiente: Number(e.target.value) })}
                      />
                    </div>

                    <div className="form-group">
                      <label>Frecuencia de Pago</label>
                      <select
                        className="form-control"
                        value={editingCredit.frecuencia}
                        onChange={(e) => setEditingCredit({ ...editingCredit, frecuencia: e.target.value })}
                      >
                        <option value="DIARIO">Diario</option>
                        <option value="SEMANAL">Semanal</option>
                        <option value="QUINCENAL">Quincenal</option>
                        <option value="MENSUAL">Mensual</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Estado del Crédito</label>
                      <select
                        className="form-control"
                        value={editingCredit.estado}
                        onChange={(e) => setEditingCredit({ ...editingCredit, estado: e.target.value })}
                      >
                        <option value="ACTIVO">Activo</option>
                        <option value="MORA">En Mora</option>
                        <option value="PAGADO">Pagado</option>
                      </select>
                    </div>
                  </>
                )}

                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '16px' }}>
                  {editingCredit ? 'Actualizar Crédito' : 'Crear Crédito Activo'}
                </button>
              </form>
            </div>

            <div className="panel">
              <div className="panel-header">
                <h2 className="panel-title">Trazabilidad de Créditos</h2>
              </div>
              <div className="table-wrapper">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Monto</th>
                      <th>Total</th>
                      <th>Amortizado</th>
                      <th>Cuota</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {creditos.map(c => (
                      <tr key={c.id}>
                        <td data-label="Cliente" className="allow-wrap">
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 600 }}>{c.clienteNombre}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Desembolso: {c.fecha}</span>
                          </div>
                        </td>
                        <td data-label="Monto">${c.monto.toLocaleString()}</td>
                        <td data-label="Total">${c.totalAPagar.toLocaleString()}</td>
                        <td data-label="Amortizado">
                          <div style={{ display: 'flex', flexDirection: 'column', width: '100px' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>${c.pagado.toLocaleString()}</span>
                            <div className="progress-bar-container" style={{ height: '4px' }}>
                              <div className="progress-bar" style={{
                                width: `${Math.round((c.pagado / c.totalAPagar) * 100)}%`,
                                backgroundColor: 'var(--color-success)'
                              }}></div>
                            </div>
                          </div>
                        </td>
                        <td data-label="Cuota" style={{ fontWeight: 600 }}>${c.valorCuota.toLocaleString()}</td>
                        <td data-label="Estado">
                          <span className={`badge ${c.estado === 'PAGADO' ? 'badge-success' :
                            c.estado === 'MORA' ? 'badge-danger' : 'badge-neutral'
                            }`}>
                            {c.estado}
                          </span>
                        </td>
                        <td data-label="Acciones">
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {c.estado !== 'PAGADO' && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleSendReminder(c)}
                                style={{ borderColor: '#10b981', color: '#10b981' }}
                                title="Enviar Recordatorio por WhatsApp"
                              >
                                <Share2 size={14} /> Recordatorio
                              </button>
                            )}
                            {user?.rol === 'ADMIN' && (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => {
                                    setEditingCredit(c);
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                  }}
                                >
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  style={{ color: 'var(--color-danger)' }}
                                  onClick={() => handleDeleteCredit(c.id)}
                                >
                                  Eliminar
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'pagos' && (
          <div className="section-container" style={{ gridTemplateColumns: '1fr 2fr' }}>
            <div className="panel">
              <div className="panel-header">
                <h2 className="panel-title">Registrar Abono Diario</h2>
              </div>
              <form onSubmit={handleAddPayment}>
                <div className="form-group">
                  <label htmlFor="creditSelect">Seleccionar Crédito Activo</label>
                  <select
                    id="creditSelect"
                    className="form-control"
                    value={newPayment.creditoId}
                    onChange={(e) => setNewPayment({ ...newPayment, creditoId: e.target.value })}
                  >
                    <option value="">Seleccione un crédito</option>
                    {activeCredits.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.clienteNombre} - Restante: ${c.saldoPendiente.toLocaleString()}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="payMonto">Monto del Abono ($)</label>
                  <input
                    id="payMonto"
                    type="number"
                    className="form-control"
                    placeholder="Ej. 40000"
                    value={newPayment.monto}
                    onChange={(e) => setNewPayment({ ...newPayment, monto: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="payTipo">Método de Pago</label>
                  <select
                    id="payTipo"
                    className="form-control"
                    value={newPayment.tipo}
                    onChange={(e) => setNewPayment({ ...newPayment, tipo: e.target.value })}
                  >
                    <option value="EFECTIVO">Efectivo Físico</option>
                    <option value="RENOVACION">Renovación de Saldo</option>
                  </select>
                </div>

                {/* Geolocation fields hidden from user view but kept in state */}
                <input type="hidden" value={newPayment.lat} />
                <input type="hidden" value={newPayment.lng} />

                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '16px' }}>
                  <TrendingUp size={18} /> Registrar Transacción
                </button>
              </form>
            </div>

            <div className="panel">
              <div className="panel-header">
                <h2 className="panel-title">Transacciones de Cobro Diario (Caja Física)</h2>
                {user?.rol === 'ADMIN' && (
                  <button 
                    type="button"
                    className="btn-export"
                    onClick={() => {
                      const headers = ["ID Pago", "ID Credito", "Cliente", "Telefono", "Cobrador", "Monto Pagado", "Tipo", "Fecha Hora", "GPS"];
                      const dataToExport = pagos.map(p => [
                        p.id,
                        p.creditoId,
                        p.clienteNombre,
                        p.clienteTelefono || "",
                        p.cobrador,
                        p.monto,
                        p.tipo,
                        p.fecha,
                        p.lat && p.lng ? `${p.lat},${p.lng}` : "Sin GPS"
                      ]);
                      exportToCSV(dataToExport, `Zenu_Recaudos_${new Date().toISOString().split('T')[0]}`, headers);
                    }}
                  >
                    <FileDown size={14} /> Exportar a Excel
                  </button>
                )}
              </div>
              <div className="transaction-list">
                {pagos.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No hay transacciones registradas hoy.
                  </div>
                ) : (
                  pagos.map(p => {
                    const creditObj = creditos.find(c => c.id === p.creditoId || c.clienteNombre === p.clienteNombre);
                    const clientObj = clientes.find(cl => cl.id === creditObj?.clienteId || cl.nombre === p.clienteNombre);
                    
                    const receipt = {
                      id: p.id,
                      clienteNombre: p.clienteNombre,
                      clienteTelefono: p.clienteTelefono || clientObj?.telefono || '',
                      monto: p.monto,
                      tipo: p.tipo,
                      fecha: p.fecha,
                      cobrador: p.cobrador,
                      saldoPendiente: creditObj ? creditObj.saldoPendiente : 0,
                      estadoCredito: creditObj ? creditObj.estado : 'ACTIVO'
                    };

                    return (
                      <div className="transaction-card" key={p.id}>
                        <div className="transaction-header">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="transaction-ref">Transacción #00{p.id}</span>
                            <span className="badge badge-neutral">{p.tipo}</span>
                          </div>
                          <span className="transaction-amount">+${p.monto.toLocaleString()}</span>
                        </div>
                        
                        <div className="transaction-body">
                          <div className="transaction-field">
                            <span className="transaction-label">Cliente</span>
                            <span className="transaction-value">{p.clienteNombre}</span>
                          </div>
                          <div className="transaction-field">
                            <span className="transaction-label">Cobrador</span>
                            <span className="transaction-value">{p.cobrador}</span>
                          </div>
                        </div>

                        <div className="transaction-footer">
                          <div className="transaction-meta">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Clock size={12} style={{ color: 'var(--text-muted)' }} />
                              <span>{p.fecha.split('T')[0]} {p.fecha.includes('T') ? p.fecha.split('T')[1].substring(0, 5) : ''}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <MapPin size={12} style={{ color: p.lat && p.lng ? 'var(--color-danger)' : 'var(--text-muted)' }} />
                              <span>{p.lat && p.lng ? `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}` : 'Sin GPS'}</span>
                            </div>
                          </div>
                          
                          <div className="transaction-actions">
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                setReceiptData(receipt);
                                setShowReceiptModal(true);
                              }}
                              title="Imprimir Comprobante"
                              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px' }}
                            >
                              🖨️ Imprimir
                            </button>
                            <button 
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleShareWhatsApp(p)}
                              title="Compartir Comprobante por WhatsApp"
                              style={{ borderColor: '#10b981', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px' }}
                            >
                              <Share2 size={12} /> WhatsApp
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'gastos' && (
          <div className="section-container" style={{ gridTemplateColumns: '1fr 2fr' }}>
            <div className="panel">
              <div className="panel-header">
                <h2 className="panel-title">Nuevo Gasto de Ruta</h2>
              </div>
              <form onSubmit={handleAddGasto}>
                <div className="form-group">
                  <label htmlFor="gastoDesc">Descripción del Gasto</label>
                  <input
                    id="gastoDesc"
                    type="text"
                    className="form-control"
                    placeholder="Ej. Gasolina moto Centro"
                    value={newGasto.descripcion}
                    onChange={(e) => setNewGasto({ ...newGasto, descripcion: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="gastoMonto">Monto Egresado ($)</label>
                  <input
                    id="gastoMonto"
                    type="number"
                    className="form-control"
                    placeholder="Ej. 15000"
                    value={newGasto.monto}
                    onChange={(e) => setNewGasto({ ...newGasto, monto: e.target.value })}
                  />
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '12px' }}>
                  <PlusCircle size={18} /> Registrar Gasto
                </button>
              </form>
            </div>

            <div className="panel">
              <div className="panel-header">
                <h2 className="panel-title">Historial de Gastos de Ruta</h2>
                {user?.rol === 'ADMIN' && (
                  <button 
                    type="button"
                    className="btn-export"
                    onClick={() => {
                      const headers = ["ID Gasto", "Cobrador", "Descripcion", "Monto Gasto", "Fecha"];
                      const dataToExport = gastos.map(g => [
                        g.id,
                        g.cobrador,
                        g.descripcion,
                        g.monto,
                        g.fecha
                      ]);
                      exportToCSV(dataToExport, `Zenu_Gastos_${new Date().toISOString().split('T')[0]}`, headers);
                    }}
                  >
                    <FileDown size={14} /> Exportar a Excel
                  </button>
                )}
              </div>
              <div className="table-wrapper">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Cobrador</th>
                      <th>Descripción</th>
                      <th>Monto</th>
                      <th>Fecha</th>
                      {user?.rol === 'ADMIN' && <th>Acciones</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {gastos.map(g => (
                      <tr key={g.id}>
                        <td data-label="Cobrador" style={{ fontWeight: 600 }}>{g.cobrador}</td>
                        <td data-label="Descripción">{g.descripcion}</td>
                        <td data-label="Monto" style={{ color: 'var(--color-danger)', fontWeight: 600 }}>-${g.monto.toLocaleString()} COP</td>
                        <td data-label="Fecha">{g.fecha}</td>
                        {user?.rol === 'ADMIN' && (
                          <td data-label="Acciones">
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ color: 'var(--color-danger)' }}
                              onClick={() => handleDeleteGasto(g.id)}
                            >
                              <Trash2 size={14} /> Eliminar
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {gastos.length === 0 && (
                      <tr>
                        <td colSpan={user?.rol === 'ADMIN' ? 5 : 4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                          No hay gastos operativos registrados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'liquidaciones' && user?.rol === 'ADMIN' && (
          <>
            <button 
              type="button" 
              className="btn btn-secondary btn-sm mobile-only" 
              onClick={() => setActiveTab('configuraciones')}
              style={{ marginBottom: '15px' }}
            >
              ← Volver a Ajustes
            </button>
            <div className="section-container" style={{ gridTemplateColumns: '1fr 2fr' }}>
            <div className="panel">
              <div className="panel-header">
                <h2 className="panel-title">Cuadre de Caja Diario</h2>
              </div>
              <form onSubmit={handlePreviewLiqSubmit}>
                <div className="form-group">
                  <label htmlFor="liqCobrador">Seleccionar Cobrador</label>
                  <select
                    id="liqCobrador"
                    className="form-control"
                    value={liqForm.cobradorId}
                    onChange={(e) => {
                      setLiqForm({ ...liqForm, cobradorId: e.target.value });
                      setLiqPreview(null);
                    }}
                  >
                    <option value="">Seleccione un cobrador</option>
                    {cobradoresList.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="liqFecha">Fecha a Liquidar</label>
                  <input
                    id="liqFecha"
                    type="date"
                    className="form-control"
                    value={liqForm.fecha}
                    onChange={(e) => {
                      setLiqForm({ ...liqForm, fecha: e.target.value });
                      setLiqPreview(null);
                    }}
                  />
                </div>

                <button type="submit" className="btn btn-secondary" style={{ width: '100%', marginBottom: '16px' }}>
                  <RefreshCw size={18} /> Calcular Cierre Teórico
                </button>
              </form>

              {liqPreview && (
                <div className="liquid-summary-box">
                  <h4 style={{ fontWeight: 700, borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                    Resumen de Operación
                  </h4>
                  <div className="liquid-summary-row">
                    <span className="liquid-summary-label">Recaudo Diario:</span>
                    <span className="liquid-summary-value" style={{ color: 'var(--color-success)' }}>
                      +${liqPreview.totalRecaudado.toLocaleString()}
                    </span>
                  </div>
                  <div className="liquid-summary-row">
                    <span className="liquid-summary-label">Gastos Registrados:</span>
                    <span className="liquid-summary-value" style={{ color: 'var(--color-danger)' }}>
                      -${liqPreview.totalGastos.toLocaleString()}
                    </span>
                  </div>
                  <div className="liquid-summary-row" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '6px', fontWeight: 700 }}>
                    <span className="liquid-summary-label">Efectivo Esperado:</span>
                    <span className="liquid-summary-value">
                      ${liqPreview.efectivoEsperado.toLocaleString()}
                    </span>
                  </div>

                  {/* Desglose de Recaudos */}
                  <div style={{ marginTop: '14px', borderTop: '1px dashed var(--border-color)', paddingTop: '10px' }}>
                    <h5 style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                      Desglose de Recaudos ({liqPreview.pagosDetalle?.length || 0})
                    </h5>
                    {liqPreview.pagosDetalle && liqPreview.pagosDetalle.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '150px', overflowY: 'auto', marginBottom: '10px', paddingRight: '4px' }}>
                        {liqPreview.pagosDetalle.map((p: any) => (
                          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', background: 'rgba(255,255,255,0.02)', padding: '6px 8px', borderRadius: '4px' }}>
                            <span>{p.cliente_nombre || 'Cliente'} <span style={{ opacity: 0.6 }}>({p.tipo})</span></span>
                            <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>+${Number(p.monto).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 10px 0' }}>Sin recaudos hoy.</p>
                    )}
                  </div>

                  {/* Desglose de Gastos */}
                  <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '10px' }}>
                    <h5 style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                      Desglose de Gastos ({liqPreview.gastosDetalle?.length || 0})
                    </h5>
                    {liqPreview.gastosDetalle && liqPreview.gastosDetalle.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '150px', overflowY: 'auto', marginBottom: '10px', paddingRight: '4px' }}>
                        {liqPreview.gastosDetalle.map((g: any) => (
                          <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', background: 'rgba(255,255,255,0.02)', padding: '6px 8px', borderRadius: '4px' }}>
                            <span>{g.descripcion}</span>
                            <span style={{ fontWeight: 600, color: 'var(--color-danger)' }}>-${Number(g.monto).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 10px 0' }}>Sin gastos hoy.</p>
                    )}
                  </div>

                  <div className="form-group" style={{ marginTop: '10px' }}>
                    <label htmlFor="liqEntregado">Efectivo Entregado por Cobrador ($)</label>
                    <input
                      id="liqEntregado"
                      type="number"
                      className="form-control"
                      value={liqForm.efectivoEntregado}
                      onChange={(e) => setLiqForm({ ...liqForm, efectivoEntregado: e.target.value })}
                      placeholder="Ingrese el monto físico real"
                    />
                  </div>

                  {liqForm.efectivoEntregado !== '' && (
                    <div className={`liquid-difference-alert ${
                      Number(liqForm.efectivoEntregado) - liqPreview.efectivoEsperado === 0 ? 'ok' : 'error'
                    }`}>
                      Diferencia: ${(Number(liqForm.efectivoEntregado) - liqPreview.efectivoEsperado).toLocaleString()} COP
                    </div>
                  )}

                  <button className="btn btn-primary" onClick={handleSaveLiq} style={{ marginTop: '8px' }}>
                    Guardar y Cerrar Jornada
                  </button>
                </div>
              )}
            </div>

            <div className="panel">
              <div className="panel-header">
                <h2 className="panel-title">Liquidaciones de Caja Guardadas</h2>
              </div>
              <div className="liquidation-list">
                {liquidaciones.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No hay liquidaciones guardadas en el sistema.
                  </div>
                ) : (
                  liquidaciones.map(l => {
                    const esperado = l.totalRecaudado - l.totalGastos;
                    return (
                      <div className="liquidation-card" key={l.id}>
                        <div className="liquidation-header">
                          <span className="liquidation-date">Fecha: {l.fecha}</span>
                          <span className={`badge ${l.estado === 'APROBADO' ? 'badge-success' : 'badge-warning'}`}>
                            {l.estado}
                          </span>
                        </div>
                        
                        <div className="liquidation-body">
                          <div className="liquidation-field">
                            <span className="liquidation-label">Cobrador</span>
                            <span className="liquidation-value">{l.cobrador}</span>
                          </div>
                          
                          <div className="liquidation-field">
                            <span className="liquidation-label">Diferencia</span>
                            <span className="liquidation-value" style={{ 
                              color: l.diferencia === 0 ? 'var(--color-success)' : 'var(--color-danger)',
                              fontWeight: 700 
                            }}>
                              ${l.diferencia.toLocaleString()}
                            </span>
                          </div>

                          <div className="liquidation-field">
                            <span className="liquidation-label">Esperado</span>
                            <span className="liquidation-value">${esperado.toLocaleString()} (${l.totalRecaudado.toLocaleString()} - ${l.totalGastos.toLocaleString()})</span>
                          </div>

                          <div className="liquidation-field">
                            <span className="liquidation-label">Entregado</span>
                            <span className="liquidation-value" style={{ fontWeight: 600 }}>${l.efectivoEntregado.toLocaleString()}</span>
                          </div>
                        </div>

                        {l.estado === 'PENDIENTE' && (
                          <div className="liquidation-footer">
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => handleApproveLiq(l.id)}
                              style={{ width: '100%' }}
                            >
                              Aprobar Cierre de Caja
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
          </>
        )}

        {activeTab === 'configuraciones' && (
          <div className="section-container" style={{ gridTemplateColumns: '1fr' }}>
            <div className="panel">
              <div className="panel-header">
                <h2 className="panel-title">Configuración del Sistema</h2>
              </div>
              
              {/* Información del Perfil */}
              <div className="profile-card">
                <div className="profile-avatar-large">
                  {user?.nombre.charAt(0).toUpperCase()}
                </div>
                <div className="profile-details">
                  <h3>{user?.nombre}</h3>
                  <p><strong>Correo Electrónico:</strong> {user?.email}</p>
                  <p><strong>Rol en Sistema:</strong> <span className="badge badge-neutral">{user?.rol === 'ADMIN' ? 'Administrador' : 'Cobrador'}</span></p>
                  <p><strong>Estado Conexión:</strong> <span className={`status-dot ${apiOnline ? 'online' : 'offline'}`} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }}></span>{apiOnline ? 'Conectado a la API' : 'Desconectado / Modo Local'}</p>
                </div>
              </div>

              {/* Gestión Administrativa (Solo en Móviles) */}
              {user?.rol === 'ADMIN' && (
                <div className="mobile-only" style={{ marginTop: '25px', borderBottom: '1px solid var(--border-color)', paddingBottom: '20px' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '15px' }}>Panel de Administración</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <button 
                      type="button" 
                      className="btn btn-secondary"
                      onClick={() => {
                        setActiveTab('rutas');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      style={{ justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '12px', fontWeight: 600 }}
                    >
                      📍 Gestión de Rutas
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-secondary"
                      onClick={() => {
                        setActiveTab('usuarios');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      style={{ justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '12px', fontWeight: 600 }}
                    >
                      👤 Gestión de Usuarios
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-secondary"
                      onClick={() => {
                        setActiveTab('liquidaciones');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      style={{ justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '12px', fontWeight: 600 }}
                    >
                      ✅ Liquidación Diaria
                    </button>
                  </div>
                </div>
              )}

              {/* Selector de Apariencia */}
              <div style={{ marginTop: '20px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '15px' }}>Tema de la Aplicación</h3>
                <div className="theme-selector-grid">
                  <div 
                    className={`theme-card ${theme === 'dark' ? 'active' : ''}`}
                    onClick={() => setTheme('dark')}
                  >
                    <div className="theme-preview-circle dark"></div>
                    <span>Tema Oscuro</span>
                  </div>
                  <div 
                    className={`theme-card ${theme === 'light' ? 'active' : ''}`}
                    onClick={() => setTheme('light')}
                  >
                    <div className="theme-preview-circle light"></div>
                    <span>Tema Claro</span>
                  </div>
                </div>
              </div>

              {/* Respaldo de Base de Datos (Solo ADMIN) */}
              {user?.rol === 'ADMIN' && (
                <div style={{ marginTop: '30px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '15px' }}>Copias de Seguridad</h3>
                  <div className="card-glass" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      El sistema está programado para enviar automáticamente a las 7:00 PM un correo a todos los administradores activos con los respaldos de la base de datos en formato Excel (CSV).
                    </p>
                    
                    <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                      <button 
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleDownloadBackup}
                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 600, fontSize: '0.85rem' }}
                        title="Descargar respaldo local en formato ZIP (Excel/CSV)"
                      >
                        💾 Descargar Excel (ZIP)
                      </button>
                      <button 
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleSendTestBackupEmail}
                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 600, fontSize: '0.85rem', borderColor: '#10b981', color: '#10b981' }}
                        title="Enviar copia actual al correo de administrador"
                      >
                        📧 Probar Correo
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Acciones de Sesión */}
              <div style={{ marginTop: '40px', borderTop: '1px solid var(--border-color)', paddingTop: '30px', width: '100%' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '15px', color: 'var(--color-danger)' }}>Acciones de Cuenta</h3>
                <button 
                  className="btn btn-secondary" 
                  onClick={handleLogout}
                  style={{ width: '100%', borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
                >
                  <LogOut size={16} style={{ marginRight: '8px' }} /> Cerrar Sesión Activa
                </button>
              </div>

            </div>
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="bottom-nav">
        <button
          className={`bottom-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <LayoutDashboard size={20} />
          <span>Inicio</span>
        </button>
        <button
          className={`bottom-nav-item ${activeTab === 'clientes' ? 'active' : ''}`}
          onClick={() => setActiveTab('clientes')}
        >
          <Users size={20} />
          <span>Clientes</span>
        </button>
        <button
          className={`bottom-nav-item ${activeTab === 'creditos' ? 'active' : ''}`}
          onClick={() => setActiveTab('creditos')}
        >
          <CreditCard size={20} />
          <span>Créditos</span>
        </button>
        <button
          className={`bottom-nav-item ${activeTab === 'pagos' ? 'active' : ''}`}
          onClick={() => setActiveTab('pagos')}
        >
          <TrendingUp size={20} />
          <span>Recaudo</span>
        </button>
        <button
          className={`bottom-nav-item ${activeTab === 'gastos' ? 'active' : ''}`}
          onClick={() => setActiveTab('gastos')}
        >
          <TrendingUp size={20} style={{ transform: 'rotate(180deg)', color: 'var(--color-danger)' }} />
          <span>Gastos</span>
        </button>
        <button
          className={`bottom-nav-item ${activeTab === 'configuraciones' ? 'active' : ''}`}
          onClick={() => setActiveTab('configuraciones')}
        >
          <Settings size={20} />
          <span>Ajustes</span>
        </button>
      </nav>

      {/* Modal del Recibo POS Térmico */}
      {showReceiptModal && receiptData && (
        <div className="receipt-modal-overlay">
          <div className="receipt-modal-content">
            <div className="receipt-print-area">
              <h3>ZENU CREDITS</h3>
              <p style={{ textAlign: 'center', fontSize: '0.75rem', margin: '0 0 10px 0' }}>COMPROBANTE DE ABONO</p>
              <p style={{ textAlign: 'center', margin: '0' }}>--------------------------------</p>
              <p><strong>Nro Recibo:</strong> #00{receiptData.id}</p>
              <p><strong>Fecha:</strong> {new Date(receiptData.fecha).toLocaleString()}</p>
              <p><strong>Cliente:</strong> {receiptData.clienteNombre}</p>
              <p><strong>Cobrador:</strong> {receiptData.cobrador}</p>
              <p style={{ textAlign: 'center', margin: '0' }}>--------------------------------</p>
              <p><strong>Valor Recibido:</strong> ${receiptData.monto.toLocaleString()} COP</p>
              <p><strong>Método de Pago:</strong> {receiptData.tipo}</p>
              <p><strong>Saldo Pendiente:</strong> ${receiptData.saldoPendiente.toLocaleString()} COP</p>
              <p><strong>Estado Crédito:</strong> {receiptData.estadoCredito}</p>
              <p style={{ textAlign: 'center', margin: '0' }}>--------------------------------</p>
              <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '0.8rem' }}>
                <p>¡Gracias por su pago!</p>
                <p>Conserve este comprobante</p>
              </div>
            </div>
            <div className="receipt-modal-actions">
              <button 
                className="btn btn-primary" 
                onClick={() => window.print()}
                style={{ width: '100%' }}
              >
                🖨️ Imprimir Recibo
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={() => handleShareWhatsApp(receiptData)}
                style={{ width: '100%', borderColor: '#10b981', color: '#10b981' }}
              >
                💬 Compartir por WhatsApp
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  setShowReceiptModal(false);
                  setReceiptData(null);
                }}
                style={{ width: '100%', marginTop: '5px' }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
