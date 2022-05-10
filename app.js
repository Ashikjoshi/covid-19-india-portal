const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

const app = express();

app.use(express.json());

let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () =>
      console.log("server is running at http://localhost:3000/")
    );
  } catch (error) {
    console.log(`DBPath error : ${error.message}`);
    process.exit(1);
  }
};
initializeDbAndServer();

const convertStateDbObjectToResponseObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const convertDistrictDbObjectToResponseObject = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

function authenticateToken(request, response, next) {
  let jwtToken;
  const authHeadher = request.headers["Authorization"];
  if (authHeadher !== undefined) {
    jwtToken = authHeadher.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "my_password", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid Jwt Token");
      } else {
        next();
      }
    });
  }
}

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectQuery = `
    select * from user where username = ${username}`;
  const dbUser = await db.get(selectQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payLoad = { username: username };
      const jwtToken = jwt.sign(payload, "my_password");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

app.get("/states/",authenticateToken, async (request, response) => {
  const getStateQuery = `
    select * from state `;
  const stateQuery = await db.all(getStateQuery);
  response.send(stateQuery.map((eachState) =>
            convertStateDbObjectToResponseObject(eachState)
        ));
});

app.get("/states/:stateId/",authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `
    select * from state where state_id = ${stateId}`;
  const stateQuery = await db.all(getStateQuery);
  response.send(convertStateDbObjectToResponseObject(stateQuery));
});

app.post("/districts/",authenticateToken, async (request, response) => {
  const { districtName, state, cases, active, deaths } = request.body;
  const postDistrictQuery = `
    INSERT INTO
    district (state_id, district_name, cases, cured, active, deaths)
  VALUES
    (${stateId}, '${districtName}', ${cases}, ${cured}, ${active}, ${deaths});`;
    await db.run(postDistrictQuery);
    response.send("District Successfully Added")
});

app.get("/districts/:districtId/",authenticateToken, async (request, response) => {
  const { districtId } = request.params;
  const getDistrictIdQuery = `select * from district 
    where district_id = ${districtId}`;
  const districtIdQuery = await db.get(getDistrictIdQuery);
  response.send(convertDistrictDbObjectToResponseObject(districtIdQuery));
});

app.delete("/districts/:districtId/",authenticateToken, async (request, response) =>{
       const { districtId } = request.params;
       const deleteDistrictIdQuery =`
       delete frpm district where district_id = ${districtId}`
       
       await db.run(deleteDistrictIdQuery)
       response.send("District Removed")
}
)
app.put(
    "/districts/:districtId/",
    authenticateToken,
    async (request, response) => {
        const { districtId } = request.params;
        const {
            districtName,
            stateId,
            cases,
            cured,
            active,
            deaths,
        } = request.body;
        const updateDistrictQuery = `
  UPDATE
    district
  SET
    district_name = '${districtName}',
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active}, 
    deaths = ${deaths}
  WHERE
    district_id = ${districtId};
  `;

        await db.run(updateDistrictQuery);
        response.send("District Details Updated");
    }
);

app.get(
    "/states/:stateId/stats/",
    authenticateToken,
    async (request, response) => {
        const { stateId } = request.params;
        const getStateStatsQuery = `
    SELECT
      SUM(cases),
      SUM(cured),
      SUM(active),
      SUM(deaths)
    FROM
      district
    WHERE
      state_id=${stateId};`;
        const stats = await db.get(getStateStatsQuery);
        response.send({
            totalCases: stats["SUM(cases)"],
            totalCured: stats["SUM(cured)"],
            totalActive: stats["SUM(active)"],
            totalDeaths: stats["SUM(deaths)"],
        });
    }
);

module.exports = app;
