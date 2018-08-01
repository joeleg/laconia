const AWSMock = require("aws-sdk-mock");
const S3Spier = require("../src/S3Spier");
const { yields } = require("laconia-test-helper");
const _ = require("lodash");

describe("S3Spier", () => {
  let lc;

  afterEach(() => {
    AWSMock.restore();
  });

  describe("#track", () => {
    let s3;
    beforeEach(() => {
      lc = {
        event: { foo: "bar" },
        context: { functionName: "function name" }
      };
      s3 = {
        putObject: jest.fn().mockImplementation(yields())
      };
      AWSMock.mock("S3", "putObject", s3.putObject);
    });

    it("should call s3 with the configured bucket name", async () => {
      const spier = new S3Spier("bucket name", "function name");
      await spier.track(lc);
      expect(s3.putObject).toBeCalledWith(
        expect.objectContaining({ Bucket: "bucket name" }),
        expect.any(Function)
      );
    });

    it("should generate unique bucket item name", async () => {
      const spier = new S3Spier("bucket name", "function name");
      await spier.track(_.merge(lc, { context: { awsRequestId: "123" } }));
      await spier.track(_.merge(lc, { context: { awsRequestId: "456" } }));

      const keys = s3.putObject.mock.calls.map(c => c[0].Key);
      expect(keys).toHaveLength(2);
      keys.forEach(k => {
        expect(k).toStartWith("function name/");
      });
      expect(keys[0]).not.toEqual(keys[1]);
    });

    it("should track event object", async () => {
      const spier = new S3Spier("bucket name", "function name");
      await spier.track(lc);
      expect(s3.putObject).toBeCalledWith(
        expect.objectContaining({ Body: expect.any(String) }),
        expect.any(Function)
      );

      const body = JSON.parse(s3.putObject.mock.calls[0][0].Body);
      expect(body).toEqual({ event: { foo: "bar" } });
    });

    it("should make sure the object stored in S3 openable easily in a browser and an edito", async () => {
      const spier = new S3Spier("bucket name", "function name");
      await spier.track(lc);
      expect(s3.putObject).toBeCalledWith(
        expect.objectContaining({
          Key: expect.stringMatching(/.json$/),
          ContentType: "application/json"
        }),
        expect.any(Function)
      );
    });
  });
});
