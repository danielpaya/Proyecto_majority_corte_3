import Constants from 'expo-constants';
import * as Location from "expo-location";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, Dimensions, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { WebView } from "react-native-webview";
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from "../../contexts/AuthContext";
import { createSignedUrlForPath, supabase } from '../../utils/supabase';
import { FabChat } from '@/components/FabChat';

type Coord = { latitude: number; longitude: number };

export default function MapScreen() {
  const [userLocation, setUserLocation] = useState<Coord | null>(null);
  const webViewRef = useRef<any>(null);
  const locationSubRef = useRef<any>(null);
  const { profile } = useAuth();
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);
  const windowHeight = Dimensions.get('window').height;
  const sheetHeight = Math.round(windowHeight / 3);
  const sheetAnim = useRef(new Animated.Value(sheetHeight)).current;
  const [currentRoute, setCurrentRoute] = useState<{ coords: Coord[]; origin: Coord; dest: Coord; distance: number; label?: string | null } | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [mode, setMode] = useState<'walk'|'car'|'moto'>('walk');
  const [followUser, setFollowUser] = useState<boolean>(true);
  const params = useLocalSearchParams<{ missionLat?: string | string[]; missionLng?: string | string[]; missionName?: string | string[]; missionToken?: string | string[] }>();
  const pendingMissionRef = useRef<{ lat: number; lng: number; label?: string | null } | null>(null);
  const lastMissionKeyRef = useRef<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          console.warn("Permisos de ubicación denegados");
          return;
        }
        const loc = await Location.getCurrentPositionAsync({});
        setUserLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      } catch (e) {
        console.warn("Error obteniendo ubicación:", e);
      }
    })();
  }, []);

  // Resolver avatar (puede ser URL pública o path en Supabase Storage)

  // Función para formatear ETA según modo
  function formatEta(distanceMeters: number, m: 'walk'|'car'|'moto') {
    // velocidades en m/s
    const speeds: Record<string, number> = { walk: 1.3889, car: 11.111, moto: 12.5 };
    const s = speeds[m];
    if (!s) return '--';
    const seconds = distanceMeters / s;
    if (seconds < 60) return `${Math.round(seconds)} s`;
    const mins = Math.round(seconds / 60);
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return `${hrs} h ${rem} m`;
  }

  // Iniciar la ruta: inyectar drawRoute y guardar en Supabase
  async function startRoute() {
    if (!currentRoute) return;
    try {
      const js = `(function(){ var coords = ${JSON.stringify(currentRoute.coords)}; window.drawRoute(coords); })();`;
      webViewRef.current?.injectJavaScript(js);

      // empezar a escuchar la posición del usuario y actualizar el avatar en el WebView
      try {
        if (locationSubRef.current) {
          locationSubRef.current.remove();
          locationSubRef.current = null;
        }
        const sub = await Location.watchPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 2000,
          distanceInterval: 2,
        }, (loc) => {
          const lat = loc.coords.latitude;
          const lng = loc.coords.longitude;
          const jsUpdate = `(function(){ if(window.updateAvatar) window.updateAvatar(${lat}, ${lng}); })();`;
          webViewRef.current?.injectJavaScript(jsUpdate);
        });
        locationSubRef.current = sub;
        // enviar una actualización inicial inmediata
        if (userLocation) {
          const initJs = `(function(){ if(window.updateAvatar) window.updateAvatar(${userLocation.latitude}, ${userLocation.longitude}); })();`;
          webViewRef.current?.injectJavaScript(initJs);
        }
        // asegurar que el WebView sabe si debe centrar al usuario
        try {
          const followJs = `(function(){ if(window.setFollow) window.setFollow(${followUser}); })();`;
          webViewRef.current?.injectJavaScript(followJs);
        } catch (e) {
          // noop
        }
      } catch (e) {
        console.warn('Error starting location watch:', e);
      }

      // Guardar la ruta en Supabase (si hay usuario)
      try {
        await saveRouteToSupabase(profile?.id ?? null, currentRoute.origin, currentRoute.dest, currentRoute.coords, currentRoute.distance);
      } catch (e) {
        console.warn('Error guardando ruta en Supabase:', e);
      }

      // ocultar sheet
      Animated.timing(sheetAnim, { toValue: sheetHeight, duration: 250, useNativeDriver: true }).start(() => {
        setSheetVisible(false);
        setCurrentRoute(null);
      });
    } catch (e) {
      console.warn('startRoute error:', e);
    }
  }

  async function cancelRoute() {
    try {
      // stop location subscription if any
      try {
        if (locationSubRef.current) {
          locationSubRef.current.remove();
          locationSubRef.current = null;
        }
      } catch (e) {
        console.warn('Error removing location subscription:', e);
      }

      const js = `(function(){ if(window.clearRoute) window.clearRoute(); })();`;
      webViewRef.current?.injectJavaScript(js);
      Animated.timing(sheetAnim, { toValue: sheetHeight, duration: 200, useNativeDriver: true }).start(() => {
        setSheetVisible(false);
        setCurrentRoute(null);
      });
    } catch (e) {
      console.warn('cancelRoute error:', e);
    }
  }

  // cleanup on unmount: remove location subscription
  useEffect(() => {
    return () => {
      try {
        if (locationSubRef.current) {
          locationSubRef.current.remove();
          locationSubRef.current = null;
        }
      } catch (e) {
        // noop
      }
    };
  }, []);
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!profile?.avatar_url) {
        if (mounted) setAvatarSrc(null);
        return;
      }

      const av = profile.avatar_url;
      if (av.startsWith('http://') || av.startsWith('https://')) {
        if (mounted) setAvatarSrc(av);
        return;
      }

      // intentar generar signed URL
      const signed = await createSignedUrlForPath(av, 60);
      if (mounted) setAvatarSrc(signed ?? null);
    })();
    return () => { mounted = false; };
  }, [profile?.avatar_url]);

  useEffect(() => {
    const latParam = Array.isArray(params.missionLat) ? params.missionLat[0] : params.missionLat;
    const lngParam = Array.isArray(params.missionLng) ? params.missionLng[0] : params.missionLng;
    if (!latParam || !lngParam) return;
    const lat = Number.parseFloat(latParam as string);
    const lng = Number.parseFloat(lngParam as string);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const labelParam = Array.isArray(params.missionName) ? params.missionName[0] : params.missionName;
    const tokenParam = Array.isArray(params.missionToken) ? params.missionToken[0] : params.missionToken;
    const key = `${lat.toFixed(5)}:${lng.toFixed(5)}:${labelParam ?? ''}:${tokenParam ?? ''}`;
    if (key === lastMissionKeyRef.current) return;
    lastMissionKeyRef.current = key;
    pendingMissionRef.current = { lat, lng, label: labelParam ?? null };
    if (userLocation) {
      const label = labelParam ?? null;
      pendingMissionRef.current = null;
      requestRoute({ latitude: lat, longitude: lng }, { label });
    }
  }, [params.missionLat, params.missionLng, params.missionName, params.missionToken, userLocation, requestRoute]);

  useEffect(() => {
    if (userLocation && pendingMissionRef.current) {
      const pending = pendingMissionRef.current;
      pendingMissionRef.current = null;
      requestRoute({ latitude: pending.lat, longitude: pending.lng }, { label: pending.label ?? null });
    }
  }, [userLocation, requestRoute]);

  const requestRoute = useCallback(
    async (dest: Coord, meta?: { label?: string | null }) => {
      if (!userLocation) {
        Alert.alert('Ubicacion requerida', 'Necesitamos tu ubicacion actual para calcular la ruta.');
        return;
      }
      setLoadingRoute(true);
      try {
        const routeResult = await getRouteFromORS(userLocation, dest);
        const routeCoords = routeResult?.coords ?? [];

        if (routeResult?.source === 'OSRM') {
          setFallbackMessage('OpenRouteService no disponible - usando fallback OSRM');
        } else {
          setFallbackMessage(null);
        }

        if (!routeCoords || routeCoords.length === 0) {
          const errJs = `(function(){ alert('No se encontro ruta.'); })();`;
          webViewRef.current?.injectJavaScript(errJs);
          return;
        }

        const distance = computeDistanceMeters(routeCoords);
        setCurrentRoute({
          coords: routeCoords,
          origin: userLocation,
          dest,
          distance,
          label: meta?.label ?? null,
        });

        const labelPayload = JSON.stringify(meta?.label ?? '');
        const setDestJs = `(function(){ if(window.setDestination){ window.setDestination(${dest.latitude}, ${dest.longitude}, ${labelPayload}); } })();`;
        webViewRef.current?.injectJavaScript(setDestJs);

        setSheetVisible(true);
        sheetAnim.setValue(sheetHeight);
        Animated.timing(sheetAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
      } catch (err) {
        console.warn('requestRoute error:', err);
        Alert.alert('Ruta no disponible', 'No pudimos preparar la ruta seleccionada.');
      } finally {
        setLoadingRoute(false);
      }
    },
    [userLocation, sheetAnim, sheetHeight]
  );

  const onMessage = async (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);

      if (msg.type === "DESTINATION_SELECTED") {
        const dest = { latitude: msg.lat, longitude: msg.lng };
        await requestRoute(dest);
      }
    } catch (e) {
      console.warn("Error procesando mensaje del mapa:", e);
    }
  };

  const mapHtml = userLocation
    ? generateMapHtml(userLocation.latitude, userLocation.longitude, avatarSrc ?? null)
    : null;

  if (!mapHtml) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        originWhitelist={["*"]}
        source={{ html: mapHtml }}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess
        allowUniversalAccessFromFileURLs
        mixedContentMode="always"
      />
      {fallbackMessage && (
        <View style={styles.fallbackBanner} pointerEvents="none">
          <Text style={styles.fallbackText}>{fallbackMessage}</Text>
        </View>
      )}
      {loadingRoute && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#1e90ff" />
        </View>
      )}
      {sheetVisible && currentRoute && (
        <Animated.View style={[styles.sheet, { height: sheetHeight, transform: [{ translateY: sheetAnim }] }]}>
          <Text style={styles.sheetTitle}>
            {currentRoute.label ? `Ruta hacia ${currentRoute.label}` : 'Ruta preparada'}
          </Text>
          <Text style={styles.sheetSubtitle}>Distancia: {(currentRoute.distance/1000).toFixed(2)} km</Text>

          <View style={styles.modesRow}>
            <TouchableOpacity style={[styles.modeBtn, mode === 'walk' && styles.modeBtnActive]} onPress={() => setMode('walk')}>
              <Text style={styles.modeTxt}>Caminar</Text>
              <Text style={styles.modeEta}>{formatEta(currentRoute.distance, 'walk')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modeBtn, mode === 'car' && styles.modeBtnActive]} onPress={() => setMode('car')}>
              <Text style={styles.modeTxt}>Carro</Text>
              <Text style={styles.modeEta}>{formatEta(currentRoute.distance, 'car')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modeBtn, mode === 'moto' && styles.modeBtnActive]} onPress={() => setMode('moto')}>
              <Text style={styles.modeTxt}>Moto</Text>
              <Text style={styles.modeEta}>{formatEta(currentRoute.distance, 'moto')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.sheetActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={async () => { await cancelRoute(); }}>
              <Text style={styles.cancelTxt}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.startBtn} onPress={async () => { await startRoute(); }}>
              <Text style={styles.startTxt}>Iniciar ruta</Text>
            </TouchableOpacity>
          </View>
           <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8}}>
             <Text style={{fontSize: 14}}>Seguir usuario</Text>
             <TouchableOpacity
               style={[styles.followBtn, followUser && styles.followBtnActive]}
               onPress={async () => {
                 const next = !followUser;
                 setFollowUser(next);
                 const js = `(function(){ if(window.setFollow) window.setFollow(${next}); })();`;
                 webViewRef.current?.injectJavaScript(js);
               }}
             >
               <Text style={styles.followTxt}>{followUser ? 'ON' : 'OFF'}</Text>
             </TouchableOpacity>
           </View>
        </Animated.View>
      )}
      <FabChat />
    </View>
  );
}

const extras = (Constants.expoConfig && Constants.expoConfig.extra) || (Constants.manifest && (Constants.manifest as any).extra) || {};
const ORS_API_KEY = extras.EXPO_PUBLIC_ORS_API_KEY || process.env.EXPO_PUBLIC_ORS_API_KEY;
const MAPTILER_KEY = extras.EXPO_PUBLIC_MAPTILER_KEY || process.env.EXPO_PUBLIC_MAPTILER_KEY;
const MAPTILER_STYLE = extras.EXPO_PUBLIC_MAPTILER_STYLE || process.env.EXPO_PUBLIC_MAPTILER_STYLE || 'streets';

async function getRouteFromORS(origin: Coord, dest: Coord) {
  try {
    const url = `https://api.openrouteservice.org/v2/directions/driving-car/geojson`;
    const body = {
      coordinates: [
        [origin.longitude, origin.latitude],
        [dest.longitude, dest.latitude],
      ],
    };
    if (!ORS_API_KEY) {
      throw new Error('ORS API key missing (EXPO_PUBLIC_ORS_API_KEY)');
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `${ORS_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch (e) {
      // no JSON
    }

    if (!res.ok) {
      console.warn('ORS response not ok', res.status, json ?? text);
      // Si el error es 403 (acceso denegado), intentar fallback a OSRM público
      if (res.status === 403) {
        console.warn('ORS returned 403, intentando fallback a OSRM público');
        const osrmResult = await getRouteFromOSRM(origin, dest);
        if (osrmResult && osrmResult.coords && osrmResult.coords.length) return { coords: osrmResult.coords, source: 'OSRM' };
        return { coords: [], source: 'ORS', error: `ORS ${res.status}` };
      }

      return { coords: [], source: 'ORS', error: `ORS ${res.status}: ${JSON.stringify(json ?? text)}` };
    }

    if (!json || !json.features || !json.features[0] || !json.features[0].geometry) {
      console.warn('ORS returned unexpected body', json);
      // intentar fallback
      const osrmResult = await getRouteFromOSRM(origin, dest);
      if (osrmResult && osrmResult.coords && osrmResult.coords.length) return { coords: osrmResult.coords, source: 'OSRM' };
      return { coords: [], source: 'ORS', error: 'ORS returned no geometry' };
    }

    const coords: [number, number][] = json.features[0].geometry.coordinates;
    return { coords: coords.map(([lon, lat]) => ({ latitude: lat, longitude: lon })), source: 'ORS' };
  } catch (e) {
    console.warn("Error obteniendo ruta de ORS:", e);
    // intentar fallback OSRM
    try {
      const osrmResult = await getRouteFromOSRM(origin, dest);
      if (osrmResult && osrmResult.coords && osrmResult.coords.length) return { coords: osrmResult.coords, source: 'OSRM' };
    } catch (ee) {
      console.warn('Error en fallback OSRM:', ee);
    }
    return { coords: [], source: 'ERROR', error: String(e) };
  }
}

// Fallback usando OSRM público (proyecto OSRM). Útil cuando ORS no está disponible.
async function getRouteFromOSRM(origin: Coord, dest: Coord) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${dest.longitude},${dest.latitude}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) {
      const txt = await res.text();
      let json: any = null;
      try { json = txt ? JSON.parse(txt) : null; } catch(_) {}
      console.warn('OSRM fallback failed', res.status, json ?? txt);
      return { coords: [], source: 'OSRM', error: `OSRM ${res.status}` };
    }
    const json = await res.json();
    if (!json.routes || !json.routes[0] || !json.routes[0].geometry) return { coords: [], source: 'OSRM' };
    const coords: [number, number][] = json.routes[0].geometry.coordinates;
    return { coords: coords.map(([lon, lat]) => ({ latitude: lat, longitude: lon })), source: 'OSRM' };
  } catch (e) {
    console.warn('Error obteniendo ruta de OSRM:', e);
    return { coords: [], source: 'OSRM', error: String(e) };
  }
}

const generateMapHtml = (lat: number, lng: number, avatarUrl: string | null) => `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Leaflet Map</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
    />
    <style>
      html, body, #map {
        height: 100%;
        margin: 0;
        padding: 0;
      }
      .avatar-marker {
        background: #1e90ff;
        border-radius: 50%;
        width: 18px;
        height: 18px;
        border: 2px solid white;
      }
    </style>
  </head>
  <body>
    <div id="map"></div>

    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      var map = L.map('map').setView([${lat}, ${lng}], 15);

        // Usar MapTiler si está configurado, si no, fallback a OpenStreetMap
        if ("${MAPTILER_KEY}" && "${MAPTILER_KEY}" !== "undefined") {
            L.tileLayer('https://api.maptiler.com/maps/${MAPTILER_STYLE}/256/{z}/{x}/{y}.png?key=${MAPTILER_KEY}', {
              tileSize: 256,
              maxZoom: 20,
              attribution: '&copy; MapTiler & OpenStreetMap contributors'
            }).addTo(map);
        } else {
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors'
          }).addTo(map);
        }

      var avatarMarker = null;
      if (${avatarUrl ? "true" : "false"}) {
        var avatarIcon = L.icon({
          iconUrl: '${avatarUrl ?? ""}',
          iconSize: [40, 40],
          className: 'avatar-image-icon'
        });
        avatarMarker = L.marker([${lat}, ${lng}], { icon: avatarIcon }).addTo(map);
      } else {
        var avatarIcon = L.divIcon({
          className: 'avatar-marker'
        });
        avatarMarker = L.marker([${lat}, ${lng}], { icon: avatarIcon }).addTo(map);
      }

      var routeLine = null;

      var destMarker = null;
      map.on('click', function(e) {
        var dest = e.latlng;
        // mostrar un marcador temporal en el mapa para la elección del destino
        if (!destMarker) {
          destMarker = L.marker(dest).addTo(map);
        } else {
          destMarker.setLatLng(dest);
        }

        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'DESTINATION_SELECTED',
          lat: dest.lat,
          lng: dest.lng
        }));
      });

      window.setDestination = function(lat, lng, label) {
        var dest = L.latLng(lat, lng);
        if (!destMarker) {
          destMarker = L.marker(dest).addTo(map);
        } else {
          destMarker.setLatLng(dest);
        }
        if (label && destMarker.bindPopup) {
          destMarker.bindPopup(label).openPopup();
        } else if (destMarker.unbindPopup) {
          destMarker.unbindPopup();
        }
        try {
          map.panTo(dest);
        } catch (e) {
          // noop
        }
      };

      window.drawRoute = function(coords) {
        if (!coords || coords.length === 0) return;

        if (routeLine) {
          map.removeLayer(routeLine);
        }

        var latlngs = coords.map(function(c) {
          return L.latLng(c.latitude, c.longitude);
        });

        // Dibujar la línea de ruta y ajustar vista. No animamos el avatar aquí;
        // el avatar será movido por actualizaciones en tiempo real desde la app.
        routeLine = L.polyline(latlngs, { color: '#1e90ff', weight: 4 }).addTo(map);
        map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });

        // colocar marcador de destino en la última coordenada
        var last = latlngs[latlngs.length - 1];
        if (destMarker) {
          destMarker.setLatLng(last);
        } else {
          destMarker = L.marker(last).addTo(map);
        }

        // Asegurar que el avatar exista y esté en el inicio de la ruta (no lo animamos)
        try {
          if (avatarMarker && latlngs.length > 0) {
            avatarMarker.setLatLng(latlngs[0]);
          }
        } catch (e) {
          console.warn('drawRoute set avatar error', e);
        }
      };

        // control para centrar el mapa en el avatar
        var followEnabled = true;
        window.setFollow = function(enabled) { followEnabled = !!enabled; };

        // Actualizar la posición del avatar desde la app nativa
        window.updateAvatar = function(lat, lng) {
          try {
            if (avatarMarker) {
              avatarMarker.setLatLng([lat, lng]);
            } else {
              avatarMarker = L.marker([lat, lng], { icon: avatarIcon }).addTo(map);
            }
            // centrar el mapa si está activado
            if (followEnabled) {
              try { map.panTo([lat, lng]); } catch(e) { /* noop */ }
            }
          } catch (e) {
            console.warn('updateAvatar error', e);
          }
        };
      // Limpiar ruta y marcador
      window.clearRoute = function() {
        try {
          if (routeLine) {
            map.removeLayer(routeLine);
            routeLine = null;
          }
          if (destMarker) {
            map.removeLayer(destMarker);
            destMarker = null;
          }
          // volver avatar al origen
          if (avatarMarker) {
            avatarMarker.setLatLng([${lat}, ${lng}]);
          }
        } catch (e) {
          console.warn('clearRoute error', e);
        }
      };
    </script>
  </body>
</html>
`;

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)'
  }
  ,
  fallbackBanner: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    padding: 8,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffeeba',
    alignItems: 'center',
    justifyContent: 'center'
  },
  fallbackText: {
    color: '#856404'
  }
  ,
  sheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 10,
  },
  sheetTitle: { fontSize: 16, fontWeight: '600' },
  sheetSubtitle: { fontSize: 14, color: '#666', marginTop: 4 },
  modesRow: { flexDirection: 'row', marginTop: 12, justifyContent: 'space-between' },
  modeBtn: { flex: 1, padding: 8, marginHorizontal: 4, borderRadius: 8, backgroundColor: '#f0f0f0', alignItems: 'center' },
  modeBtnActive: { backgroundColor: '#e6f0ff' },
  modeTxt: { fontWeight: '600' },
  modeEta: { marginTop: 4, color: '#333' },
  sheetActions: { flexDirection: 'row', marginTop: 12, justifyContent: 'space-between' },
  cancelBtn: { flex: 1, padding: 12, marginRight: 8, borderRadius: 8, backgroundColor: '#f8d7da', alignItems: 'center' },
  cancelTxt: { color: '#721c24', fontWeight: '600' },
  startBtn: { flex: 1, padding: 12, marginLeft: 8, borderRadius: 8, backgroundColor: '#1e90ff', alignItems: 'center' },
  startTxt: { color: '#fff', fontWeight: '700' },
  followBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#f0f0f0' },
  followBtnActive: { backgroundColor: '#dff0ff' },
  followTxt: { fontWeight: '600' },
});

// Calcular distancia total (metros) sumando segmentos haversine
function computeDistanceMeters(coords: Coord[]) {
  if (!coords || coords.length < 2) return 0;
  const R = 6371000; // metros
  let d = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i];
    const b = coords[i+1];
    const φ1 = a.latitude * Math.PI/180;
    const φ2 = b.latitude * Math.PI/180;
    const Δφ = (b.latitude - a.latitude) * Math.PI/180;
    const Δλ = (b.longitude - a.longitude) * Math.PI/180;
    const aa = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1-aa));
    d += R * c;
  }
  return Math.round(d);
}

// Guardar la ruta en Supabase (tabla 'routes')
async function saveRouteToSupabase(userId: string | null, origin: Coord, dest: Coord, path: Coord[], distance: number) {
  try {
    if (!userId) return;
    const row = {
      user_id: userId,
      origin_lat: origin.latitude,
      origin_lng: origin.longitude,
      dest_lat: dest.latitude,
      dest_lng: dest.longitude,
      distance_m: distance,
      path: JSON.stringify(path),
      created_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('routes').insert(row);
    if (error) {
      console.warn('Supabase insert routes error:', error);
    }
  } catch (e) {
    console.warn('saveRouteToSupabase error:', e);
  }
}
