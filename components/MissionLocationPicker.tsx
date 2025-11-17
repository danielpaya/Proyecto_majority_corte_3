import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

export type MissionCoordinate = { latitude: number; longitude: number };

type MissionLocationPickerProps = {
  value?: MissionCoordinate | null;
  onChange?: (coord: MissionCoordinate) => void;
  height?: number;
};

const DEFAULT_CENTER: MissionCoordinate = { latitude: 4.711, longitude: -74.072 };

export function MissionLocationPicker({ value, onChange, height = 220 }: MissionLocationPickerProps) {
  const webViewRef = useRef<WebView>(null);
  const center = value ?? DEFAULT_CENTER;

  const mapHtml = useMemo(
    () => generatePickerHtml(center.latitude, center.longitude, Boolean(value)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [center.latitude, center.longitude]
  );

  useEffect(() => {
    if (value) {
      const js = `(function(){ if(window.setPickerMarker){ window.setPickerMarker(${value.latitude}, ${value.longitude}); } })();`;
      webViewRef.current?.injectJavaScript(js);
    }
  }, [value?.latitude, value?.longitude]);

  return (
    <View style={[styles.wrapper, { height }]}>
      <WebView
        ref={webViewRef}
        source={{ html: mapHtml }}
        originWhitelist={['*']}
        onMessage={(event) => {
          try {
            const payload = JSON.parse(event.nativeEvent.data);
            if (payload?.type === 'LOCATION_PICKED' && typeof payload.lat === 'number' && typeof payload.lng === 'number') {
              onChange?.({ latitude: payload.lat, longitude: payload.lng });
            }
          } catch {
            // ignore parse errors
          }
        }}
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess
        allowUniversalAccessFromFileURLs
        mixedContentMode="always"
      />
    </View>
  );
}

function generatePickerHtml(lat: number, lng: number, hasInitial: boolean) {
  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
      html, body, #map {
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      var initialLat = ${lat};
      var initialLng = ${lng};
      var map = L.map('map').setView([initialLat, initialLng], ${hasInitial ? 15 : 13});
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      var marker = null;
      function updateMarker(lat, lng) {
        var point = L.latLng(lat, lng);
        if (!marker) {
          marker = L.marker(point).addTo(map);
        } else {
          marker.setLatLng(point);
        }
      }

      if (${hasInitial ? 'true' : 'false'}) {
        updateMarker(initialLat, initialLng);
      }

      map.on('click', function(e) {
        updateMarker(e.latlng.lat, e.latlng.lng);
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'LOCATION_PICKED',
          lat: e.latlng.lat,
          lng: e.latlng.lng
        }));
      });

      window.setPickerMarker = function(lat, lng) {
        updateMarker(lat, lng);
        map.panTo([lat, lng]);
      };
    </script>
  </body>
</html>
`;
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d0d4dc',
  },
});
