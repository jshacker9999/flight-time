window.addEventListener("earthjsload", function () {
  Earth.addMesh(airplaneMesh);
  myearth = new Earth("myearth", {
    location: { lat: 20, lng: 10 },
    light: "none",
    mapLandColor: "#fff",
    mapSeaColor: "#66d8ff",
    mapBorderColor: "#66d8ff",
    mapBorderWidth: 0.4,
  });

  myearth.addEventListener("ready", function () {
    var fromSelect = document.getElementById("from");
    var toSelect = document.getElementById("to");

    for (var i = 0; i < airports.length; i++) {
      var marker = this.addMarker({
        mesh: ["Pin", "Needle"],
        color: "#00a8ff",
        color2: "#9f9f9f",
        offset: -0.2,
        location: { lat: airports[i][2], lng: airports[i][3] },
        scale: 0.01,
        visible: false,
        hotspot: true,
        hotspotRadius: 0.4,
        hotspotHeight: 1.5,

        index: i,
        airportCode: airports[i][0],
        airportName: airports[i][1],
      });

      marker.addEventListener("mouseover", function () {
        document.getElementById("tip-layer").style.opacity = 1;
        document.getElementById("tip-big").innerHTML = this.airportCode;
        document.getElementById("tip-small").innerHTML = this.airportName
          .split(",")
          .join("<br>");

        this.color = "red";
      });

      marker.addEventListener("mouseout", function () {
        if (this != startMarker && this != endMarker) {
          this.color = "#00a8ff";
        }
        document.getElementById("tip-layer").style.opacity = 0;
      });

      marker.addEventListener("click", function () {
        if (!startMarker) {
          selectStartMarker(this);
        } else {
          selectEndMarker(this);
        }
      });

      markers.push(marker);

      var option = document.createElement("option");
      option.text = airports[i][0] + " | " + airports[i][1];
      fromSelect.add(option);

      var option = document.createElement("option");
      option.text = airports[i][0] + " | " + airports[i][1];
      toSelect.add(option);
    }

    restorePins();
  });
});

var markers = [];

var flying = false;
var plane, X;
var startMarker, endMarker;
var dashedLine, solidLine;
var flightScale = 1;

function selectStartMarker(marker) {
  document.body.classList.add("config-start");

  document.getElementById("from").setAttribute("disabled", true);
  document.getElementById("from").selectedIndex = marker.index + 1;
  document.getElementById("to").removeAttribute("disabled");

  startMarker = marker;
  startMarker.dispatchEvent({ type: "mouseout" });
  startMarker.hotspot = false;
  startMarker.animate("scale", 0.01, {
    easing: "in-quad",
    complete: function () {
      this.visible = false;
      plane.animate("scale", 1.2, { easing: "out-back" });
    },
  });

  plane = myearth.addMarker({
    mesh: "plane",
    color: "#444",

    location: marker.location,
    scale: 0.01,
    offset: 0,
    lookAt: { lat: 0, lng: 0 },
    hotspot: false,
    transparent: true,
  });

  myearth.goTo(marker.location, {
    duration: 200,
    relativeDuration: 300,
    approachAngle: 20,
  });
}

function selectEndMarker(marker) {
  document.getElementById("to").setAttribute("disabled", true);
  document.getElementById("to").selectedIndex = marker.index + 1;

  endMarker = marker;
  endMarker.dispatchEvent({ type: "mouseout" });
  endMarker.hotspot = false;
  endMarker.animate("scale", 0.01, {
    easing: "in-quad",
    complete: function () {
      this.visible = false;
      X.animate("scale", 0.8 * flightScale, { easing: "out-back" });
    },
  });

  myearth.goTo(marker.location, {
    duration: 200,
    relativeDuration: 300,
    approachAngle: 20,
  });

  startFlight();
}

function startFlight() {
  flying = true;

  shrinkPins();

  var distance = Earth.getDistance(startMarker.location, endMarker.location);
  flightScale = 1;

  if (distance < 3000) {
    flightScale = 0.6 + (flightScale / 3000) * 0.4;
    plane.animate("scale", 1.2 * flightScale);
  }

  var flightTime = 2000 + distance;

  X = myearth.addMarker({
    mesh: "X",
    color: "#444",

    location: endMarker.location,
    scale: 0.01,
    offset: 0,
    hotspot: false,
  });

  dashedLine = myearth.addLine({
    locations: [startMarker.location, endMarker.location],
    color: "red",
    width: 1.25 * flightScale,
    offsetFlow: flightScale,
    dashed: true,
    dashSize: 0.25 * flightScale,
    dashRatio: 0.5,
    clip: 0,
    alwaysBehind: true,
  });

  dashedLine.animate("clip", 1, { duration: 1000 + distance / 10 });

  solidLine = myearth.addLine({
    locations: [startMarker.location, endMarker.location],
    color: "red",
    width: 1.25 * flightScale,
    offsetFlow: flightScale,
    clip: 0,
    alwaysBehind: true,
  });

  plane.animate("lookAt", endMarker.location, {
    duration: 50,
    relativeDuration: 200,
    complete: function () {
      plane.animate("offset", flightScale * 0.75, {
        duration: flightTime,
        easing: "arc",
      });
      plane.animate("location", endMarker.location, {
        duration: flightTime,
        easing: "linear",
        complete: function () {
          dashedLine.remove();
          flying = false;
        },
      });

      plane.animate("rotationZ", 15 * flightScale, {
        duration: flightTime / 2,
        easing: "arc",
        complete: function () {
          if (!flying) return;

          plane.animate("rotationZ", -15 * flightScale, {
            duration: flightTime / 2,
            easing: "arc",
          });
          X.animate("scale", 0.01, {
            duration: flightTime / 2,
            easing: "in-quart",
            complete: function () {
              this.remove();
            },
          });

          document.getElementById("tip-big").innerHTML =
            Math.ceil(distance / 500) / 2 + "h";
          document.getElementById("tip-small").innerHTML =
            startMarker.airportCode + " - " + endMarker.airportCode;
          document.getElementById("tip-layer").style.opacity = 1;
        },
      });

      var syncLineToPlane = function () {
        if (!flying) {
          solidLine.clip = 1;
          myearth.removeEventListener("update", syncLineToPlane);
          return;
        }

        dashedLine.dashOffset -= 0.001;

        var from = startMarker.object3d.position;
        var to = endMarker.object3d.position;
        var mid = plane.object3d.position;

        var before = from.distanceTo(mid);
        var after = to.distanceTo(mid);

        var t = before / (before + after);

        solidLine.clip = t;
      };

      myearth.addEventListener("update", syncLineToPlane);
    },
  });
}

function reset() {
  flying = false;

  document.body.classList.remove("config-start");
  document.getElementById("tip-layer").style.opacity = 0;

  document.getElementById("from").selectedIndex = 0;
  document.getElementById("from").removeAttribute("disabled");
  document.getElementById("to").setAttribute("disabled", true);
  document.getElementById("to").selectedIndex = 0;

  if (plane) {
    plane.animate("scale", 0.01, {
      complete: function () {
        this.remove();
      },
    });
  }
  if (X) {
    X.animate("scale", 0.01, {
      complete: function () {
        this.remove();
      },
    });
  }
  if (dashedLine) {
    dashedLine.animate("width", 0.01, {
      complete: function () {
        this.remove();
      },
    });
  }
  if (solidLine) {
    solidLine.animate("width", 0.01, {
      complete: function () {
        this.remove();
      },
    });
  }

  startMarker = false;
  endMarker = false;

  restorePins();
}

var pinIndex = 0;
var pinTime = 0;
var pinsPerSec = 1000 / 18;

function shrinkPins() {
  pinIndex = 0;

  var shrinkOnePin = function () {
    markers[pinIndex].animate("scale", 0.01, {
      complete: function () {
        this.visible = false;
      },
    });

    if (++pinIndex >= markers.length) {
      myearth.removeEventListener("update", shrinkOnePin);
    }
  };

  myearth.addEventListener("update", shrinkOnePin);
}

function restorePins() {
  pinIndex = 0;
  pinTime = myearth.deltaTime;

  var restoreOnePin = function () {
    pinTime += myearth.deltaTime;
    if (pinTime > pinsPerSec) {
      pinTime -= pinsPerSec;
    } else {
      return;
    }

    if (!markers[pinIndex].visible) {
      markers[pinIndex].visible = true;
      markers[pinIndex].hotspot = true;
      markers[pinIndex].animate("scale", 1, {
        duration: 560,
        easing: "out-back",
      });
    } else {
      pinTime = pinsPerSec;
    }

    if (++pinIndex >= markers.length) {
      myearth.removeEventListener("update", restoreOnePin);
    }
  };

  myearth.addEventListener("update", restoreOnePin);
}

function toggleSidebar() {
  document.body.classList.toggle("sidebar-open");
}

function selectFrom() {
  var index = document.getElementById("from").selectedIndex;
  if (index == 0) return;
  markers[index - 1].dispatchEvent({ type: "click" });
}

function selectTo() {
  var index = document.getElementById("to").selectedIndex;
  if (index == 0) return;
  markers[index - 1].dispatchEvent({ type: "click" });
}
