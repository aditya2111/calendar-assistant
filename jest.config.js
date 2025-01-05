module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/test"],
  testMatch: ["**/?(*.)+(spec|test).ts"],
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
};
