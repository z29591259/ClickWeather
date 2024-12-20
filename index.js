let CityList = ["桃園市"];
let CityCodeList = ["F-D0047-005"];
let LocationList = ["八德區", "龜山區"];
let ElementNameList = ["3小時降雨機率", "溫度", "天氣現象"];
let RenderTimeHourFrom = 6;
let Days = 2;
const CACHE_DATA_TIME = "cache_weather_time";
const CACHE_DATA = "cache_weather_result";
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
  // for rain pr every 3 hour one data
  StartTime = formatDateTime(now, now.getHours(), now.getMinutes(), 0);
  // for temperature, weather code every 1 hour one data
  StartHour = now.getHours();
  now.setDate(now.getDate() + days);
  EndTime = formatDateTime(now, 0, 0, 0);
}

/**
 * Format datetimestring 2024-12-18T06:00:00+08:00 to string yyyy-MM-dd
 * @param {string} dateTimeString
 * @returns {string}
 */
function formatDateFromString(dateTimeString) {
  return dateTimeString.substring(0, 10);
}

/**
 * Parse hour from datetimestring 2024-12-18T06:00:00+08:00
 * @param {string} dateTimeString
 * @returns {number}
 */
function getHourFromDateTimeString(dateTimeString) {
  return parseInt(dateTimeString.substring(11, 13), 10);
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
function formatDateTime(date, hour = -1, minute = -1, second = -1) {
  return (
    date.getFullYear() +
    "-" +
    (date.getMonth() + 1).toString().padStart(2, "0") +
    "-" +
    date.getDate().toString().padStart(2, "0") +
    "T" +
    (hour < 0
      ? date.getHours().toString().padStart(2, "0")
      : hour.toString().padStart(2, "0")) +
    ":" +
    (minute < 0
      ? date.getMinutes().toString().padStart(2, "0")
      : minute.toString().padStart(2, "0")) +
    ":" +
    (second < 0
      ? date.getSeconds().toString().padStart(2, "0")
      : second.toString().padStart(2, "0"))
  );
}

function createWeatherRecord() {
  let weatherRecordData = new WeatherRecord(new Date(), []);
  let datecodeSplit = StartTime.split("T")[0].split("-");
  for (let i = 0; i < Days; i++) {
    let date = new Date(
      datecodeSplit[1] + "-" + datecodeSplit[2] + "-" + datecodeSplit[0]
    );
    date.setDate(date.getDate() + i);
    let weatherDays = new WeatherDays(
      formatDateFromString(formatDateTime(date)),
      []
    );
    weatherRecordData.Days.push(weatherDays);
  }
  weatherRecordData.Days.forEach((weatherDays) => {
    weatherDays.Citys.push(new WeatherCity(CityList[0], []));
  });
  return weatherRecordData;
}

function fetchWeatherData() {
  document.querySelector(".loading").classList.toggle("hidden");
  let now = new Date();

  setDateBound();
  WeatherRecordData = createWeatherRecord();

  //if less than 60min use cache
  if (
    localStorage[CACHE_DATA] &&
    localStorage[CACHE_DATA_TIME] &&
    now.getTime() - parseInt(localStorage[CACHE_DATA_TIME], 10) < 3600000
  ) {
    parseWeatherData(JSON.parse(localStorage[CACHE_DATA]));
    renderWeatherData();
    document.querySelector(".loading").classList.toggle("hidden");
    return;
  }

  const formData = new FormData();
  formData.append("action", "get_weather");
  formData.append("cityList", CityCodeList.join(","));
  formData.append("LocationList", LocationList.join(","));
  formData.append("ElementName", ElementNameList.join(","));
  formData.append("startTime", StartTime);
  formData.append("endTime", EndTime);

  postData(
    "https://script.google.com/macros/s/AKfycbztXaQ1Jw1zDLJ5_zUFKiITzLvzGbYRzuSG6U8jqXh9kdbGOaGcRZw7I-pt6Sz_O4s/exec",
    formData
  )
    .then((result) => {
      parseWeatherData(result);
      localStorage[CACHE_DATA_TIME] = new Date().getTime();
      localStorage[CACHE_DATA] = JSON.stringify(result);
      renderWeatherData();
      document.querySelector(".loading").classList.toggle("hidden");
    })
    .catch((error) => {
      console.error(error);
      document.querySelector(".loading").classList.toggle("hidden");
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
    method: "POST",
    body: data,
    cache: "no-cache",
    redirect: "follow",
  })
    .then((response) => response.json())
    .catch((e) => {
      console.error(e);
    });
}

function parseWeatherData(data) {
  data.records.Locations[0].Location.forEach((location) => {
    let datecodes = [
      ...new Set(
        location.WeatherElement.filter(
          (element) => element.ElementName === "溫度"
        )[0].Time.map((x) => formatDateFromString(x.DataTime))
      ),
    ];

    datecodes.forEach((date) => {
      let weatherCity = WeatherRecordData.Days.find(
        (weatherDays) => weatherDays.Datecode === date
      ).Citys.find((weatherCity) => weatherCity.City == CityList[0]);

      let isToday = formatDateFromString(formatDateTime(new Date())) === date;

      let tempElement = location.WeatherElement.filter(
        (element) => element.ElementName === "溫度"
      )[0].Time.filter(
        (time) =>
          formatDateFromString(time.DataTime) === date &&
          getHourFromDateTimeString(time.DataTime) % 3 == 0 &&
          ((isToday && getHourFromDateTimeString(time.DataTime) >= StartHour) ||
            !isToday)
      );

      let tempTimes = tempElement.map((x) =>
        getHourFromDateTimeString(x.DataTime)
      );

      let temps = tempElement.map((x) =>
        parseInt(x.ElementValue[0].Temperature, 10)
      );

      let weatherCodes = location.WeatherElement.filter(
        (element) => element.ElementName === "天氣現象"
      )[0]
        .Time.filter(
          (time) =>
            formatDateFromString(time.StartTime) === date &&
            ((isToday &&
              getHourFromDateTimeString(time.StartTime) >= StartHour) ||
              !isToday)
        )
        .map((x) => parseInt(x.ElementValue[0].WeatherCode, 10));

      let rainElement = location.WeatherElement.filter(
        (element) => element.ElementName === "3小時降雨機率"
      )[0].Time.filter((time) => formatDateFromString(time.StartTime) === date);

      let rainTimes = rainElement.map((x) =>
        getHourFromDateTimeString(x.StartTime)
      );

      let rainPrs = rainElement.map((x) =>
        parseInt(x.ElementValue[0].ProbabilityOfPrecipitation, 10)
      );

      let weatherLocation = new WeatherLocation(
        location.LocationName,
        tempTimes,
        temps,
        weatherCodes,
        rainTimes,
        rainPrs
      );
      weatherCity.Locations.push(weatherLocation);
    });
  });
}

function renderWeatherData() {
  let now = new Date();
  let today = formatDateFromString(formatDateTime(now, 0, 0, 0));
  now.setDate(now.getDate() + 1);
  let tomorrow = formatDateFromString(formatDateTime(now, 0, 0, 0));

  let html = "";

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

    days.Citys.forEach((city) => {
      city.Locations.forEach(function (location, index, locations) {
        let cityName = location.Location.replace("區", "");
        if (mergedLocationIndex.some((x) => x === index)) {
          return;
        }
        for (let i = index + 1; i < locations.length; i++) {
          if (location.IsEqual(locations[i])) {
            mergedLocationIndex.push(i);
            cityName += "<br />" + locations[i].Location.replace("區", "");
          }
        }

        html += '<div class="container">';
        html +=
          '<div class="block"><div class="weatherColumn"><div class="weatherItem" style="height: 8rem;">' +
          cityName +
          "</div></div></div>";
        html += '<div class="block" style="min-width: 16.5rem;">';
        for (let i = 0; i < location.TempTimes.length; i++) {
          if (location.TempTimes[i] < RenderTimeHourFrom) {
            continue;
          }
          html += '<div class="weatherColumn">';
          html += `<div class="weatherItem">${location.TempTimes[i]}</div>`;
          html += `<div class="weatherItem"><img class="weatherIcon" src="${weatherImgUrl(
            days.Citys[0].Locations[0].WeatherCodes[i]
          )}" /></div>`;
          html += `<div class="weatherItem">${location.Temperatures[i]}°</div>`;
          html += `<div class="weatherItem">${
            location.RainPrs[
              location.RainTimes.findIndex((x) => x == location.TempTimes[i])
            ]
          }%</div>`;
          html += "</div>";
        }

        html += "</div></div>";
      });
    });
  });
  let weatherBoard = document.querySelector("#weatherBoard");
  weatherBoard.innerHTML = html;
}

function weatherImgUrl(statusCode) {
  switch (statusCode) {
    case 1:
      return "https://img.icons8.com/color/96/000000/summer--v1.png";
    case 2:
    case 3:
      return "https://img.icons8.com/color/96/000000/partly-cloudy-day--v1.png";
    case 4:
    case 5:
    case 6:
    case 7:
      return "https://img.icons8.com/color/96/000000/clouds.png";
    case 8:
    case 9:
    case 10:
    case 11:
    case 12:
    case 13:
    case 41:
      return "https://img.icons8.com/color/96/000000/light-rain-2--v1.png";
    case 14:
    case 29:
    case 30:
    case 31:
    case 32:
    case 39:
      return "https://img.icons8.com/color/96/000000/downpour--v1.png";
    case 15:
    case 16:
    case 17:
    case 18:
    case 22:
    case 33:
    case 34:
    case 35:
    case 36:
      return "https://img.icons8.com/color/96/000000/storm-with-heavy-rain.png";
    case 19:
      return "https://img.icons8.com/color/96/000000/partly-cloudy-rain--v1.png";
    case 20:
      return "https://img.icons8.com/color/96/000000/light-rain--v1.png";
    case 21:
      return "https://img.icons8.com/color/96/000000/chance-of-storm.png";
    case 23:
      return "https://img.icons8.com/color/96/000000/sleet.png";
    case 24:
    case 25:
    case 26:
      return "https://img.icons8.com/color/96/000000/fog-day--v1.png";
    case 27:
    case 28:
    case 37:
    case 38:
      return "https://img.icons8.com/emoji/96/000000/fog.png";
    case 42:
      return "https://img.icons8.com/color/96/000000/snow--v1.png";
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
  Datecode = "";
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
  City = "";
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
  Location = "";
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
  constructor(
    location,
    tempTimes,
    temperatures,
    weatherCodes,
    rainTimes,
    rainPrs
  ) {
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
    return (
      this.ArrayEquals(this.TempTimes, target.TempTimes) &&
      this.ArrayEquals(this.Temperatures, target.Temperatures) &&
      this.WeatherCodes.every(
        (x, index) =>
          weatherImgUrl(x) === weatherImgUrl(target.WeatherCodes[index])
      ) &&
      this.ArrayEquals(this.RainTimes, target.RainTimes) &&
      this.ArrayEquals(this.RainPrs, target.RainPrs)
    );
  }

  /**
   * Checking for array equality
   * @param {[]} a
   * @param {[]} b
   * @returns boolean
   */
  ArrayEquals(a, b) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((val, index) => val === b[index])
    );
  }
}
