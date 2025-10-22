const map = L.map("map", {
  center: [49.9, 15.3],
  zoom: 7,
  minZoom: 6,
  maxZoom: 12,
  zoomSnap: 0.25,
  attributionControl: false,
});

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> přispěvatelé',
}).addTo(map);

const infoContent = document.getElementById("info-content");

const colors = {
  "dýl": getComputedStyle(document.documentElement).getPropertyValue("--color-dyl"),
  "později": getComputedStyle(document.documentElement).getPropertyValue(
    "--color-pozdeji"
  ),
  neutral: getComputedStyle(document.documentElement).getPropertyValue(
    "--color-neutral"
  ),
};

const wordLabels = {
  "dýl": "dýl",
  "později": "později",
};

let votesData = {};
let geoLayer;
let selectedLayer = null;

const formatter = new Intl.NumberFormat("cs-CZ");

function formatPercent(value) {
  return `${value.toFixed(2).replace(".", ",")}%`;
}

function updateInfoPanel(name, stats) {
  if (!stats) {
    infoContent.innerHTML = `<p class="muted">Pro okres <strong>${name}</strong> chybí data.</p>`;
    return;
  }

  const orderedCounts = Object.entries(stats.counts).sort(([, a], [, b]) => b - a);

  const items = orderedCounts
    .map(([word, count]) => {
      const percentage = stats.percentages[word];
      return `<li><span>${wordLabels[word] ?? word}</span><span>${formatter.format(
        count
      )} · ${formatPercent(percentage)}</span></li>`;
    })
    .join("");

  const [topWord, topCount] = orderedCounts[0] ?? [];
  const secondCount = orderedCounts[1]?.[1];
  const isTie = secondCount !== undefined && topCount === secondCount;

  const badgeClass = isTie
    ? "tie"
    : topWord === "dýl"
    ? "dyl"
    : topWord === "později"
    ? "později"
    : "tie";

  const badgeLabel = isTie
    ? "Remíza"
    : topWord
    ? `Převládá ${topWord}`
    : "Bez dat";

  const shareValue =
    topCount !== undefined && stats.total ? (topCount / stats.total) * 100 : null;

  infoContent.innerHTML = `
    <header>
      <h2>${name}</h2>
      <span class="badge ${badgeClass}">${badgeLabel}
        ${shareValue !== null ? `· ${formatPercent(shareValue)}` : ""}
      </span>
    </header>
    <p>Celkem hlasů: <strong>${formatter.format(stats.total)}</strong></p>
    <ul>${items}</ul>
  `;
}

function styleFeature(feature) {
  const { name } = feature.properties;
  const stats = votesData[name];
  const dominant = stats?.dominant;
  const fillColor = dominant ? colors[dominant] : colors.neutral;
  const fillOpacity = dominant ? 0.65 : 0.25;

  return {
    fillColor,
    weight: 1.2,
    opacity: 1,
    color: "#1f2937",
    fillOpacity,
  };
}

function resetHighlight(layer, feature) {
  const baseStyle = styleFeature(feature);
  layer.setStyle(baseStyle);
}

function selectFeature(layer, feature) {
  if (selectedLayer && selectedLayer !== layer) {
    const prevFeature = selectedLayer.feature;
    resetHighlight(selectedLayer, prevFeature);
  }

  layer.setStyle({
    weight: 3,
    color: "#0f172a",
    fillOpacity: 0.75,
  });

  if (layer.bringToFront) {
    layer.bringToFront();
  }

  selectedLayer = layer;

  const { name } = feature.properties;
  updateInfoPanel(name, votesData[name]);
}

function onEachFeature(feature, layer) {
  const { name } = feature.properties;
  const stats = votesData[name];

  layer.bindTooltip(
    () => {
      const lines = [`<strong>${name}</strong>`];
      if (stats) {
        lines.push(
          `${stats.dominant ? `Převládá ${stats.dominant}` : "Bez dat"}`
        );
        lines.push(`Celkem: ${formatter.format(stats.total)}`);
      } else {
        lines.push("Bez dat");
      }
      return lines.join("<br />");
    },
    {
      sticky: true,
      direction: "auto",
      opacity: 0.9,
    }
  );

  layer.on({
    mouseover: () => {
      if (selectedLayer !== layer) {
        layer.setStyle({
          weight: 2,
          fillOpacity: 0.75,
        });
      }
    },
    mouseout: () => {
      if (selectedLayer !== layer) {
        resetHighlight(layer, feature);
      }
    },
    click: () => selectFeature(layer, feature),
  });
}

function createLegend(mapInstance) {
  const legend = L.control({ position: "bottomright" });

  legend.onAdd = () => {
    const div = L.DomUtil.create("div", "legend");
    div.innerHTML = `
      <div class="legend-item">
        <span class="legend-swatch" style="background:${colors["dýl"]};"></span>
        <span>dýl</span>
      </div>
      <div class="legend-item">
        <span class="legend-swatch" style="background:${colors["později"]};"></span>
        <span>později</span>
      </div>
      <div class="legend-item">
        <span class="legend-swatch" style="background:${colors.neutral};"></span>
        <span>bez dat</span>
      </div>
    `;
    return div;
  };

  legend.addTo(mapInstance);
}

async function bootstrap() {
  try {
    const [votesResponse, geoResponse] = await Promise.all([
      fetch("data/votes.json"),
      fetch("data/okresy.geojson"),
    ]);

    if (!votesResponse.ok) {
      throw new Error("Nepodařilo se načíst souhrnná data.");
    }
    if (!geoResponse.ok) {
      throw new Error("Nepodařilo se načíst geografická data.");
    }

    votesData = await votesResponse.json();
    const geojson = await geoResponse.json();

    geoLayer = L.geoJSON(geojson, {
      style: styleFeature,
      onEachFeature,
    }).addTo(map);

    map.fitBounds(geoLayer.getBounds(), {
      padding: [60, 60],
    });

    createLegend(map);
  } catch (error) {
    console.error(error);
    infoContent.innerHTML = `<p class="muted">${error.message}</p>`;
  }
}

bootstrap();
