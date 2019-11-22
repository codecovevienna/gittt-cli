import { expect } from "chai";
import proxyquire from "proxyquire";
import { ChartHelper } from "../../helper";

describe("ChartHelper", function () {
  before(function () {
    proxyquire.noCallThru();
  });

  it("should show chart within boundaries", async function () {
    const daysData = {
      "Monday": "3",
      "Tuesday": "14",
      "Wednesday": "39",
    }
    expect(ChartHelper.chart(daysData, true, 50, false, "h")).to.deep.eq(`Monday    ▉▉▉▉ 3h
Tuesday   ▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉ 14h
Wednesday ▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉ 39h`);
  });

  it("should show chart which overshoots boundaries", async function () {
    const daysData = {
      "Monday": "3",
      "Tuesday": "14",
      "Wednesday": "69",
    }
    expect(ChartHelper.chart(daysData, true, 50, false, "h")).to.deep.eq(`Monday    ▉▉▎ 3h
Tuesday   ▉▉▉▉▉▉▉▉▉▉▏ 14h
Wednesday ▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉ 69h`);
  });

  it("should show sorted chart within boundaries", async function () {
    const daysData = {
      "Monday": "3",
      "Tuesday": "14",
      "Wednesday": "39",
    }
    expect(ChartHelper.chart(daysData, true, 50, true, "h")).to.deep
      .eq(`Wednesday ▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉ 39h
Tuesday   ▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉ 14h
Monday    ▉▉▉▉ 3h`
      );
  });

  it("should show sorted chart within boundaries [no value]", async function () {
    const daysData = {
      "Monday": "3",
      "Tuesday": "14",
      "Wednesday": "39",
    }
    expect(ChartHelper.chart(daysData, false, 50, true, "h")).to.deep
      .eq(`Wednesday ▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉
Tuesday   ▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉
Monday    ▉▉▉▉`
      );
  });
});