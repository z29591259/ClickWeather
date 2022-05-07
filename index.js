let CityList = ['桃園市'];
let CityCodeList = ['F-D0047-005'];
let LocationList = ['八德區', '龜山區'];
let RenderTimeHourFrom = 6;
let Days = 2;
const CACHE_DATA_TIME = 'cache_weather_time';
const CACHE_DATA = 'cache_weather_result';
/**
 * Start time for api timeFrom param
 * @type {string}
 */
let StartTime;
/**
 * End time for api timeTo param
 * @type {string}
 */
let EndTime;
/**
 * Filter weather data temperature from now, every 3 hour
 * @type {number}
 */
let StartHour;

/**
 * @type {WeatherRecord}
 */
let WeatherRecordData;

function onLoad() {
    fetchWeatherData();
}

/**
 * Initialize date time param
 * @param {number} days 
 */
function setDateBound(days = 2) {
    let now = new Date();
    // for rain pr every 6 hour one data
    StartTime = formatDate(now, Math.floor(now.getHours() / 6) * 6, 0, 0);
    // for temperature, weather code every 3 hour one data
    StartHour = Math.floor(now.getHours() / 3) * 3;
    now.setDate(now.getDate() + days);
    EndTime = formatDate(now, 0, 0, 0);
}

/**
 * Format date to string yyyy-MM-ddTHH:mm:ss 
 * ref https://stackoverflow.com/a/30272803/4225117
 * @param {Date} date 
 * @param {number} hour 
 * @param {number} minute 
 * @param {number} second 
 * @returns {string}
 */
function formatDate(date, hour = -1, minute = -1, second = -1) {
    return date.getFullYear() + '-' +
        (date.getMonth() + 1).toString().padStart(2, '0') +
        '-' +
        date.getDate().toString().padStart(2, '0') +
        'T' +
        (hour < 0 ? date.getHours().toString().padStart(2, '0') : hour.toString().padStart(2, '0')) +
        ':' +
        (minute < 0 ? date.getMinutes().toString().padStart(2, '0') : minute.toString().padStart(2, '0')) +
        ':' +
        (second < 0 ? date.getSeconds().toString().padStart(2, '0') : second.toString().padStart(2, '0'));
}

function createWeatherRecord() {
    let weatherRecordData = new WeatherRecord(new Date(), []);
    let datecodeSplit = StartTime.split('T')[0].split('-');
    for (let i = 0; i < Days; i++) {
        let date = new Date(datecodeSplit[1] + '-' + datecodeSplit[2] + '-' + datecodeSplit[0]);
        date.setDate(date.getDate() + i);
        let weatherDays = new WeatherDays(formatDate(date).split('T')[0], []);
        weatherRecordData.Days.push(weatherDays);
    }
    weatherRecordData.Days.forEach(weatherDays => {
        CityList.forEach(city => {
            weatherDays.Citys.push(new WeatherCity(city, []));
        })
    })
    return weatherRecordData;
}

function fetchWeatherData() {
    document.querySelector('.loading').classList.toggle('hidden');
    let now = new Date();

    setDateBound();
    WeatherRecordData = createWeatherRecord();

    //if less than 60min use cache
    if (localStorage[CACHE_DATA] &&
        localStorage[CACHE_DATA_TIME] &&
        (now.getTime() - parseInt(localStorage[CACHE_DATA_TIME], 10) < 3600000)) {
        parseWeatherData(JSON.parse(localStorage[CACHE_DATA]));
        renderWeatherData();
        document.querySelector('.loading').classList.toggle('hidden');
        return;
    }

    const formData = new FormData();
    formData.append('action', 'get_weather');
    formData.append('cityList', CityCodeList.join(','));
    formData.append('locationList', LocationList.join(','));
    formData.append('startTime', StartTime);
    formData.append('endTime', EndTime);

    postData(
        'https://script.google.com/macros/s/AKfycbycqO_dcczKDewbw2zOsMEiG2aRwy5bBrrLhgy9ziXKzTMNWiRrRVOgQ1h1YF63brk/exec',
        formData
    ).then(result => {
        parseWeatherData(result);
        localStorage[CACHE_DATA_TIME] = new Date().getTime();
        localStorage[CACHE_DATA] = JSON.stringify(result);
        renderWeatherData();
        document.querySelector('.loading').classList.toggle('hidden');
    }).catch(function (err) {
        alert(err);
        document.querySelector('.loading').classList.toggle('hidden');
    });
}

/**
 * 
 * @param {string} url 
 * @param {object} data 
 * @returns 
 */
function postData(url, data) {
    return fetch(url, {
        body: data,
        cache: 'no-cache',
        method: 'POST'
    })
        .then(response => response.json())
        .catch(e => {
            console.log(e);
        });
}

/**
 * Parse data then adapt to WeatherRecord object
 * @param {object} data json from API
 */
function parseWeatherData(data) {
    for (let i = 0; i < data.records.locations.length; i++) {

        for (let j = 0; j < data.records.locations[i].location.length; j++) {

            //select date and distinct
            let datecodes = [...new Set(data.records.locations[i].location[j].weatherElement
                .filter(element => element.elementName === 'T')[0].time.map(x => x.dataTime.substring(0, 10)))];
            datecodes.forEach(date => {
                let weatherCity = WeatherRecordData.Days.find(weatherDays => weatherDays.Datecode === date)
                    .Citys.find(weatherCity => weatherCity.City === data.records.locations[i].locationsName);

                let isToday = formatDate(new Date()).split('T')[0] === date;
                let tempTimes = data.records.locations[i].location[j].weatherElement
                    .filter(element => element.elementName === 'T')[0].time
                    .filter(time =>
                        time.dataTime.substring(0, 10) === date &&
                        ((isToday && parseInt(time.dataTime.substring(11, 13), 10) >= StartHour) || !isToday))
                    .map(x => parseInt(x.dataTime.substring(11, 13), 10));
                let temps = data.records.locations[i].location[j].weatherElement
                    .filter(element => element.elementName === 'T')[0].time
                    .filter(time => time.dataTime.substring(0, 10) === date &&
                        ((isToday && parseInt(time.dataTime.substring(11, 13), 10) >= StartHour) || !isToday))
                    .map(x => parseInt(x.elementValue[0].value, 10));

                let weatherCodes = data.records.locations[i].location[j].weatherElement
                    .filter(element => element.elementName === 'Wx')[0].time
                    .filter(time => time.startTime.substring(0, 10) === date &&
                        ((isToday && parseInt(time.startTime.substring(11, 13), 10) >= StartHour) || !isToday))
                    .map(x => parseInt(x.elementValue[1].value, 10));

                let rainTimes = data.records.locations[i].location[j].weatherElement
                    .filter(element => element.elementName === 'PoP6h')[0].time
                    .filter(time => time.startTime.substring(0, 10) === date)
                    .map(x => parseInt(x.startTime.substring(11, 13), 10));

                let rainPrs = data.records.locations[i].location[j].weatherElement
                    .filter(element => element.elementName === 'PoP6h')[0].time
                    .filter(time => time.startTime.substring(0, 10) === date)
                    .map(x => parseInt(x.elementValue[0].value, 10));

                let weatherLocation = new WeatherLocation(
                    data.records.locations[i].location[j].locationName,
                    tempTimes,
                    temps,
                    weatherCodes,
                    rainTimes,
                    rainPrs
                );
                weatherCity.Locations.push(weatherLocation);
            });
        }
    }
}

function renderWeatherData() {
    let now = new Date();
    let today = formatDate(now, 0, 0, 0).split('T')[0];
    now.setDate(now.getDate() + 1);
    let tomorrow = formatDate(now, 0, 0, 0).split('T')[0];

    let html = '';

    WeatherRecordData.Days.forEach(function (days) {
        let mergedLocationIndex = [];
        if (days.Citys[0].Locations.length === 0) {
            return;
        }
        if (days.Datecode === today) {
            html += '<div style="text-align: center;">- 今天 -</div>';
        } else if (days.Datecode === tomorrow) {
            html += '<div style="text-align: center;">- 明天 -</div>';
        }

        days.Citys.forEach(city => {
            city.Locations.forEach(function (location, index, locations) {
                let cityName = location.Location.replace('區', '');
                if (mergedLocationIndex.some(x => x === index)) {
                    return;
                }
                for (let i = index + 1; i < locations.length; i++) {
                    if (location.IsEqual(locations[i])) {
                        mergedLocationIndex.push(i);
                        cityName += '<br />' + locations[i].Location.replace('區', '');
                    }
                }

                html += '<div class="container">';
                html += '<div class="block"><div class="weatherColumn"><div class="weatherItem" style="height: 8rem;">' + cityName + '</div></div></div>';
                html += '<div class="block" style="min-width: 16.5rem;">';
                for (let i = 0; i < location.TempTimes.length; i++) {
                    if (location.TempTimes[i] < RenderTimeHourFrom) { continue; }
                    html += '<div class="weatherColumn">';
                    html += `<div class="weatherItem">${location.TempTimes[i]}</div>`;
                    html += `<div class="weatherItem"><img class="weatherIcon" src="${weatherImgUrl(days.Citys[0].Locations[0].WeatherCodes[i])}" /></div>`;
                    html += `<div class="weatherItem">${location.Temperatures[i]}°</div>`;
                    html += `<div class="weatherItem">${location.RainPrs[location.RainTimes.findIndex(x => x <= location.TempTimes[i] && (x + 6) > location.TempTimes[i])]}%</div>`;
                    html += '</div>';
                }

                html += '</div></div>';
            });
        });
    });
    let weatherBoard = document.querySelector('#weatherBoard');
    weatherBoard.innerHTML = html;
}

function weatherImgUrl(statusCode) {
    switch (statusCode) {
        case 1:
            return 'https://img.icons8.com/color/96/000000/summer--v1.png';
        case 2:
        case 3:
            return 'https://img.icons8.com/color/96/000000/partly-cloudy-day--v1.png';
        case 4:
        case 5:
        case 6:
        case 7:
            return 'https://img.icons8.com/color/96/000000/clouds.png';
        case 8:
        case 9:
        case 10:
        case 11:
        case 12:
        case 13:
        case 41:
            return 'https://img.icons8.com/color/96/000000/light-rain-2--v1.png';
        case 14:
        case 29:
        case 30:
        case 31:
        case 32:
        case 39:
            return 'https://img.icons8.com/color/96/000000/downpour--v1.png';
        case 15:
        case 16:
        case 17:
        case 18:
        case 22:
        case 33:
        case 34:
        case 35:
        case 36:
            return 'https://img.icons8.com/color/96/000000/storm-with-heavy-rain.png';
        case 19:
            return 'https://img.icons8.com/color/96/000000/partly-cloudy-rain--v1.png';
        case 20:
            return 'https://img.icons8.com/color/96/000000/light-rain--v1.png';
        case 21:
            return 'https://img.icons8.com/color/96/000000/chance-of-storm.png';
        case 23:
            return 'https://img.icons8.com/color/96/000000/sleet.png';
        case 24:
        case 25:
        case 26:
            return 'https://img.icons8.com/color/96/000000/fog-day--v1.png';
        case 27:
        case 28:
        case 37:
        case 38:
            return 'https://img.icons8.com/emoji/96/000000/fog.png';
        case 42:
            return 'https://img.icons8.com/color/96/000000/snow--v1.png';
    }
}

class WeatherRecord {
    /**@type {Date} */
    DataTime;
    /**@type {WeatherDays[]} */
    Days = [];

    /**
     * @param {Date} datetime 
     * @param {WeatherDays[]} days 
     */
    constructor(datetime, days) {
        this.DataTime = datetime;
        this.Days = days;
    }
}

class WeatherDays {
    /**
     * yyyy-MM-dd
     * @type {string} 
     * */
    Datecode = '';
    /**@type {WeatherCity[]} */
    Citys = [];

    /**
     * @param {string} datecode 
     * @param {WeatherCity[]} citys 
     */
    constructor(datecode, citys) {
        this.Datecode = datecode;
        this.Citys = citys;
    }
}

class WeatherCity {
    /**@type {string} */
    City = '';
    /**@type {WeatherLocation[]} */
    Locations = [];

    /**
     * 
     * @param {string} city 
     * @param {WeatherLocation[]} locations 
     */
    constructor(city, locations) {
        this.City = city;
        this.Locations = locations;
    }
}

class WeatherLocation {
    /**@type {string} */
    Location = '';
    /**
     * Hour time of temperature
     * @type {number[]} 
     * */
    TempTimes = [];
    /**
     * Temperatures of each hour time, unit is C
     * @type {number[]} 
     * */
    Temperatures = [];
    /**
     * Weather code of each hour time
     * @type {number[]}
     */
    WeatherCodes = [];
    /**
     * Hour time of rain probability
     * @type {number[]} 
     * */
    RainTimes = [];
    /**
     * Rain probabilitys of each hour time, unit is percent
     * @type {number[]} 
     * */
    RainPrs = [];

    /**
     * @param {string} location 
     * @param {number[]} tempTimes 
     * @param {number[]} temperatures 
     * @param {number[]} weatherCodes
     * @param {number[]} rainTimes 
     * @param {number[]} rainPrs 
     */
    constructor(location, tempTimes, temperatures, weatherCodes, rainTimes, rainPrs) {
        this.Location = location;
        this.TempTimes = tempTimes;
        this.Temperatures = temperatures;
        this.WeatherCodes = weatherCodes;
        this.RainTimes = rainTimes;
        this.RainPrs = rainPrs;
    }

    /**
     * Checking for WeatherLocation equality
     * @param {WeatherLocation} target 
     * @returns boolean
     */
    IsEqual(target) {
        return this.ArrayEquals(this.TempTimes, target.TempTimes)
            && this.ArrayEquals(this.Temperatures, target.Temperatures)
            && this.WeatherCodes.every((x, index) => weatherImgUrl(x) === weatherImgUrl(target.WeatherCodes[index]))
            && this.ArrayEquals(this.RainTimes, target.RainTimes)
            && this.ArrayEquals(this.RainPrs, target.RainPrs);
    }

    /**
     * Checking for array equality
     * @param {[]} a 
     * @param {[]} b 
     * @returns boolean
     */
    ArrayEquals(a, b) {
        return Array.isArray(a) &&
            Array.isArray(b) &&
            a.length === b.length &&
            a.every((val, index) => val === b[index]);
    }
}