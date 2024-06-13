import { useCallback, useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import { FeatureGroup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import "leaflet-draw";
import { EditControl } from "react-leaflet-draw";
import "bootstrap/dist/css/bootstrap.min.css";
import { Button, Form } from "react-bootstrap";
import axios from "axios";
import { toast } from "react-toastify";

const EditableMap = ({ coordinates, clearCoordinates, handleSetCord }) => {
  const map = useMap();
  const drawnItemsRef = useRef(new L.FeatureGroup());

  useEffect(() => {
    map.addLayer(drawnItemsRef.current);

    return () => {
      map.removeLayer(drawnItemsRef.current);
    };
  }, [map]);

  useEffect(() => {
    if (clearCoordinates) {
      drawnItemsRef.current.clearLayers();
    }
  }, [clearCoordinates]);

  useEffect(() => {
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    if (coordinates && !clearCoordinates) {
      coordinates.forEach((coordinateSet) => {
        if (coordinateSet.type === "circle") {
          const { center, radius } = coordinateSet;
          const circle = L.circle(center, { radius, color: "blue" }).addTo(
            drawnItemsRef.current
          );
          map.fitBounds(circle.getBounds());
        } else if (coordinateSet.type === "polygon") {
          const points = coordinateSet.points.map((point) => [
            point.lat,
            point.lng,
          ]);
          const polyline = L.polyline(points, { color: "red" }).addTo(
            drawnItemsRef.current
          );
          map.fitBounds(polyline.getBounds());
        }
      });
    }

    const drawControl = new L.Control.Draw({
      draw: {
        polygon: {
          shapeOptions: {
            color: "blue",
          },
          showArea: true,
          showLength: true,
          metric: true,
          allowIntersection: false,
        },
        circle: true,
        rectangle: false,
        circlemarker: true,
        polyline: true,
      },
      edit: {
        featureGroup: drawnItems,
        remove: true,
      },
    });
    map.addControl(drawControl);

    map.on(L.Draw.Event.CREATED, function (event) {
      const layer = event.layer;
      drawnItems.addLayer(layer);
      const type = event.layerType;

      if (type === "polygon") {
        // Ensure the polygon is closed
        const polygon = L.polygon(layer.getLatLngs()[0], {
          color: "blue",
        }).addTo(drawnItemsRef.current);
        map.fitBounds(polygon.getBounds());

        const coordinates = polygon.getLatLngs()[0].map((point) => ({
          lat: point.lat,
          lng: point.lng,
        }));
        handleSetCord([{ type: "polygon", points: coordinates }]);
      } else if (type === "circle") {
        const center = layer.getLatLng();
        const radius = layer.getRadius();
        handleSetCord([
          {
            type: "circle",
            center: { lat: center.lat, lng: center.lng },
            radius,
          },
        ]);
      }
    });

    return () => {
      map.removeLayer(drawnItems);
      map.removeControl(drawControl);
    };
  }, [coordinates, clearCoordinates, map, handleSetCord]);

  return null;
};

const App = () => {
  const [loadedCoordinates, setLoadedCoordinates] = useState([]);
  const [clearCoordinates, setClearCoordinates] = useState(false);
  const [name, setName] = useState("");

  const handleSetCord = useCallback((coordinates) => {
    setLoadedCoordinates(coordinates);
  }, []);

  const handleCreate = async () => {
    if (!name) {
      toast.error("Please enter a name for the polygon.");
      return;
    }

    if (loadedCoordinates.length === 0) {
      toast.error("Please draw a polygon or circle on the map.");
      return;
    }

    if (window.confirm("Are you sure you want to create this polygon?")) {
      try {
        const response = await axios.post(
          `http://localhost:3000/api/v1/polygon`,
          {
            name,
            coordinates: loadedCoordinates,
          }
        );

        if (response.status === 201) {
          toast.success("Polygon created successfully");
          setClearCoordinates(true);
        } else {
          toast.error("Failed to create polygon");
        }
      } catch (error) {
        console.error("Error creating polygon:", error);
        toast.error("Failed to create polygon");
      }
    }
  };

  const handleClear = () => {
    setClearCoordinates(true);
    setLoadedCoordinates([]);
    // Reset the clear flag after the map updates
    setTimeout(() => setClearCoordinates(false), 100);
  };

  return (
    <div className="container-fluid vh-100">
      <div className="row h-100">
        <div className="col-3 d-flex flex-column align-items-center p-3 mt-5">
          <Form.Group className="mb-3">
            <Form.Label>Name</Form.Label>
            <Form.Control
              type="text"
              placeholder="Enter name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Form.Group>
          <Button variant="primary" onClick={handleCreate}>
            Create Polygon
          </Button>
          <Button variant="secondary" onClick={handleClear} className="mt-3">
            Clear Map
          </Button>
        </div>
        <div className="col-9 p-0">
          <MapContainer
            center={[51.505, -0.09]}
            zoom={13}
            style={{ height: "100vh", width: "100%" }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            <FeatureGroup>
              <EditableMap
                coordinates={loadedCoordinates}
                clearCoordinates={clearCoordinates}
                handleSetCord={handleSetCord}
              />
            </FeatureGroup>
          </MapContainer>
        </div>
      </div>
    </div>
  );
};

export default App;
