function createMap(){
    
    var map = L.map('map', {
        center: [20, 0],
        zoom: 2
    });

   var tilesStreets = L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}', {
        attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery   <a href="http://mapbox.com">Mapbox</a>',
        maxZoom: 18,
        id: 'mapbox.streets',
        accessToken: 'pk.eyJ1IjoiamhjYXJuZXkiLCJhIjoiY2pmbHE2ZTVlMDJnbTJybzdxNTNjaWsyMiJ9.hoiyrXTX3pOuEExAnhUtIQ'
    });
    var tilesAerial = L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}', {
        attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery   <a href="http://mapbox.com">Mapbox</a>',
        maxZoom: 18,
        id: 'mapbox.satellite',
        accessToken: 'pk.eyJ1IjoiamhjYXJuZXkiLCJhIjoiY2pmbHE2ZTVlMDJnbTJybzdxNTNjaWsyMiJ9.hoiyrXTX3pOuEExAnhUtIQ'
    });
    
    var baseTilesets = {
        "Streets": tilesStreets,
        "Aerial": tilesAerial
    };
    
    L.control.layers(baseTilesets).addTo(map);

    getData(map);
};

//Import GeoJSON data
function getData(map){
    
    //load the data
    $.ajax("data/Terrorism.geojson", {
        dataType: "json",
        success: function(response){
            
            //create an attributes array
            var attributes = processData(response);
            
            //call function to create proportional symbols, sequence controls
            createPropSymbols(response, map, attributes);
            createSequenceControls(map, attributes);
            createLegend(map, attributes);
            
        }
    });
};

//build an attributes array from the data
function processData(data){
    
    //empty array to hold attributes
    var attributes = [];

    //properties of the first feature in the dataset
    var properties = data.features[0].properties;

    //push each attribute name into attributes array
    for (var attribute in properties){
        
        //only take attributes with attackes
        if (attribute.indexOf("yr") > -1){
            attributes.push(attribute);
        };
    };

    return attributes;

};

//calculate the radius of each proportional symbol
function calcPropRadius(attValue) {
    
    //scale factor to adjust symbol size evenly
    var scaleFactor = 10;
    
    //area based on attribute value and scale factor
    var area = attValue * scaleFactor;
    
    //radius calculated based on area
    var radius = Math.sqrt(area/Math.PI);

    return radius;
};

function calculateOpacity(value) {
    var opacity = (-0.05 * value + 75) / 100;
    if (opacity < 0.25) {
        opacity = 0.25;
    }
    return opacity
}

//consolidated popup creation function
function Popup(properties, attribute, layer, radius){
    this.properties = properties;
    this.attribute = attribute;
    this.layer = layer;
    this.year = attribute.split("_")[1];
    this.attacks = this.properties[attribute];
    this.content = "<p><b>Country: </b>" + this.properties.Country + "</p><p><b>Attacks in " + +this.year + ": </b>"+ this.attacks + "</p>";
    
    this.bindToLayer = function(){
        this.layer.bindPopup(this.content, {
            offset: new L.Point(0, -radius)
        });
    };
};

//function to convert markers to circle markers
function pointToLayer(feature, latlng, attributes){

    //Step 4: Assign the current attribute based on the first index of the attributes array
    var attribute = attributes[0];

    //create marker options
    var options = {
        fillColor: "#ed0600",
        color: "#000",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8
    };

    //For each feature, determine its value for the selected attribute
    var attValue = Number(feature.properties[attribute]);

    //Give each feature's circle marker a radius based on its attribute value
    options.radius = calcPropRadius(attValue);

    //create circle marker layer
    var layer = L.circleMarker(latlng, options);

    var popup = new Popup(feature.properties, attribute, layer, options.radius);
    
    //add popup to circle marker
    popup.bindToLayer();

    //return the circle marker to the L.geoJson pointToLayer option
    return layer;
};

//Add circle markers for point features to the map
function createPropSymbols(data, map, attributes){
    
    //create a Leaflet GeoJSON layer and add it to the map
    L.geoJson(data, {
        pointToLayer: function(feature, latlng){
            return pointToLayer(feature, latlng, attributes);
        }
    }).addTo(map);
    updatePropSymbols(map, attributes[0]);
};

//resize proportional symbols according to new attribute values
function updatePropSymbols(map, attribute){
    map.eachLayer(function(layer){
        if (layer.feature && layer.feature.properties[attribute]){
            
            //access feature properties
            var props = layer.feature.properties;

            //update each feature's radius based on new attribute values
            var radius = calcPropRadius(props[attribute]);
            layer.setRadius(radius);

            var popup = new Popup(props, attribute, layer, radius);
            
            //add popup to circle marker
            popup.bindToLayer();
            
        };
    });
};

//Create new sequence controls
function createSequenceControls(map, attributes){
   var SequenceControl = L.Control.extend({
       options: {
           position: 'bottomleft'
       },
       
       onAdd: function (map) {
           
           //create the control container div with a particular class name
           var container = L.DomUtil.create('div', 'sequence-control-container');
           
           //create range input element (slider)
           $(container).append('<input class="range-slider" type="range">');
           
           //add skip buttons
           $(container).append('<img class="skip" id="reverse" src="img/Reverse1.png"/>');
           $(container).append('<img class="skip" id="forward" src="img/Forward1.png"/>');
           
           //kill any mouse event listeners on the map
           $(container).on('mousedown dblclick', function(e){
               L.DomEvent.stopPropagation(e);
           });
           
           return container;
       }
   });
    
    map.addControl(new SequenceControl());
    addSequencing(map, attributes);
        
};

function addSequencing(map, attributes){
    
    $('.range-slider').attr({
        max: 49,
        min: 0,
        value: 0,
        step: 1
    });
    
    $('.skip').click(function() {
        //get the old index value
        var index = $('.range-slider').val();
        
        //increment or decrement depending on button clicked
        if($(this).attr('id') == 'forward'){
            index++;
            index = index > 49 ? 0 : index;    
        } else if($(this).attr('id') == 'reverse'){
            index--;
            index = index < 0 ? 49 : index;
        };
        
        //update slider
        $('.range-slider').val(index);
        updatePropSymbols(map, attributes[index]);
        updateLegend(map, attributes[index]);
    });
    
    $('.range-slider').on('input', function() {
        var index = $(this).val();
        updatePropSymbols(map, attributes[index]);
        updateLegend(map, attributes[index]);
    });
}

 //function to create the legend
function createLegend(map, attributes){
    var LegendControl = L.Control.extend({
        options: {
            position: 'bottomright'
        },

        onAdd: function (map) {
            
            // create the control container with a particular class name
            var container = L.DomUtil.create('div', 'legend-control-container');

            //add temporal legend div to container
            $(container).append('<div id="temporal-legend">')

            //start attribute legend svg string
            var svg = '<svg id="attribute-legend" width="200px" height="2000px">';
            
            //array of circle names to base loop on
            var circles ={
                max: 500,
                mean: 150,
                min: 10
            };
            
            //loop to add each circle and text to svg string
            for (var circle in circles){
                //circle string
                svg += '<circle class="legend-circle" id="' + circle + '" fill="#ed0600" fill-opacity="0.8" stroke="#000000" cx="30"/>';

                //text string
                svg += '<text id="' + circle + '-text" x="65" y="' + circles[circle] + '"></text>';
            };

            //close svg string
            svg += "</svg>";


            //add attribute legend svg to container
            $(container).append(svg);

            return container;
        }
    });

    map.addControl(new LegendControl());
    updateLegend(map, attributes[0]);
};

//calculate the max, mean, and min values for a given attribute
function getCircleValues(map, attribute){
    
    //start with min at highest possible and max at lowest possible number
    var min = Infinity,
        max = -Infinity;
    
    map.eachLayer(function(layer){
        //get the attribute value
        if (layer.feature){
            var attributeValue = Number(layer.feature.properties[attribute]);
            
            //test for min
            if (attributeValue < min){
                min = attributeValue;
            };
            
            //test for max
            if (attributeValue > max){
                max = attributeValue;
            };
        };
    });
    
    //set mean
    var mean = (max + min) / 2;
    
    //return values as an object
    return {
        max: max,
        mean: mean,
        min: min
    };
};
//Update the legend with new attribute
function updateLegend(map, attribute){
    
    //create content for legend
    var year = attribute.split("_")[1];
    var content = "Terrorist Attacks in " + year;
    
    //replace legend content
    $('#temporal-legend').html(content);
    
    //get the max, mean, and min values as an object
    var circleValues = {
        max: 500,
        mean: 150,
        min: 10
    };
    
    for (var key in circleValues){
        //get the radius
        var radius = calcPropRadius(circleValues[key]);
        
        //assign the cy and r attributes
        $('#' + key).attr({
            cx: 50,
            cy: 90 - radius,
            r: radius
        });
        $('#' + key + '-text').text(circleValues[key] + '  Attacks').attr({
            x: 100,
            y: 90 - radius,
            r: radius
        });
    };

};;



//jquery method loads page
$(document).ready(createMap);