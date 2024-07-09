const germanCities = ["Munich", "Stuttgart", "Berlin", "Frankfurt", "Hannover", "Hamburg"];
let selectedCities = [];

function toggleCity(city) {
    const cityIndex = selectedCities.indexOf(city);
    if (cityIndex > -1) {
        // If the city is already in the selectedCities array, remove it using filter
        selectedCities = selectedCities.filter(selectedCity => selectedCity !== city);
    } else {
        // Add city to selectedCities and update the order
        selectedCities.push(city);
        updateSelectedCitiesOrder();
    }
    updateSelectedCitiesDisplay();
}

function updateSelectedCitiesOrder() {
    selectedCities.sort((a, b) => germanCities.indexOf(a) - germanCities.indexOf(b));
}

function updateSelectedCitiesDisplay() {
    const selectedCitiesList = document.getElementById("selectedCitiesList");
    selectedCitiesList.innerHTML = "";
    selectedCities.forEach(city => {
        const li = document.createElement("li");
        li.textContent = city;
        selectedCitiesList.appendChild(li);
    });
}

function renderCities() {
    const cityList = document.getElementById("cityList");
    cityList.innerHTML = ""; // Clear existing content
    germanCities.forEach((city, index) => {
        const div = document.createElement("div");
        div.className = "city";
        div.textContent = city;
        div.draggable = true;
        div.ondragstart = (event) => handleDragStart(event, index);
        div.ondragover = (event) => event.preventDefault();
        div.ondrop = (event) => handleDrop(event, index);
        const button = document.createElement("button");
        button.textContent = "★";
        button.onclick = () => toggleCity(city);
        div.appendChild(button);
        cityList.appendChild(div);
    });
}

function handleDragStart(event, index) {
    event.dataTransfer.setData("text/plain", index);
}

function handleDrop(event, dropIndex) {
    event.preventDefault();
    const dragIndex = event.dataTransfer.getData("text/plain");
    moveCity(dragIndex, dropIndex);
}

function moveCity(dragIndex, dropIndex) {
    const city = germanCities.splice(dragIndex, 1)[0];
    germanCities.splice(dropIndex, 0, city);
    renderCities();
    updateSelectedCitiesOrder(); // Ensure selectedCities is updated to reflect the new order
    updateSelectedCitiesDisplay(); // Update the display after re-ordering
}

renderCities();