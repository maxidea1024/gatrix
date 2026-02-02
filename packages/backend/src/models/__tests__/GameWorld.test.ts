import { GameWorldModel, CreateGameWorldData } from "../GameWorld";
import database from "../../config/database";
import logger from "../../config/logger";

// Mock dependencies
jest.mock("../../config/database");
jest.mock("../../config/logger");

const mockDatabase = database as jest.Mocked<typeof database>;
const mockLogger = logger as jest.Mocked<typeof logger>;

describe("GameWorldModel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create game world with minimum displayOrder when no worlds exist", async () => {
      const worldData: CreateGameWorldData = {
        worldId: "test-world-1",
        name: "Test World 1",
        description: "Test description",
      };

      // Mock empty database (no existing worlds)
      mockDatabase.query
        .mockResolvedValueOnce([{ nextOrder: 0 }]) // MIN query returns 0 (10 - 10)
        .mockResolvedValueOnce({ insertId: 1 }) // INSERT returns insertId
        .mockResolvedValueOnce([
          {
            // findById returns created world
            id: 1,
            worldId: "test-world-1",
            name: "Test World 1",
            isVisible: true,
            isMaintenance: false,
            displayOrder: 0,
            description: "Test description",
            tags: null,
            createdAt: "2024-01-01T00:00:00Z",
            updatedAt: "2024-01-01T00:00:00Z",
          },
        ]);

      const result = await GameWorldModel.create(worldData);

      expect(mockDatabase.query).toHaveBeenCalledWith(
        "SELECT COALESCE(MIN(displayOrder), 10) - 10 as nextOrder FROM g_game_worlds",
      );
      expect(result.displayOrder).toBe(0);
      expect(result.worldId).toBe("test-world-1");
    });

    it("should create game world with lower displayOrder than existing minimum", async () => {
      const worldData: CreateGameWorldData = {
        worldId: "test-world-2",
        name: "Test World 2",
        description: "Test description",
      };

      // Mock existing worlds with minimum displayOrder of 10
      mockDatabase.query
        .mockResolvedValueOnce([{ nextOrder: 0 }]) // MIN(10) - 10 = 0
        .mockResolvedValueOnce({ insertId: 2 }) // INSERT returns insertId
        .mockResolvedValueOnce([
          {
            // findById returns created world
            id: 2,
            worldId: "test-world-2",
            name: "Test World 2",
            isVisible: true,
            isMaintenance: false,
            displayOrder: 0,
            description: "Test description",
            tags: null,
            createdAt: "2024-01-01T00:00:00Z",
            updatedAt: "2024-01-01T00:00:00Z",
          },
        ]);

      const result = await GameWorldModel.create(worldData);

      expect(result.displayOrder).toBe(0);
      expect(result.worldId).toBe("test-world-2");
    });

    it("should use provided displayOrder when specified", async () => {
      const worldData: CreateGameWorldData = {
        worldId: "test-world-3",
        name: "Test World 3",
        displayOrder: 50,
        description: "Test description",
      };

      mockDatabase.query
        .mockResolvedValueOnce({ insertId: 3 }) // INSERT returns insertId
        .mockResolvedValueOnce([
          {
            // findById returns created world
            id: 3,
            worldId: "test-world-3",
            name: "Test World 3",
            isVisible: true,
            isMaintenance: false,
            displayOrder: 50,
            description: "Test description",
            tags: null,
            createdAt: "2024-01-01T00:00:00Z",
            updatedAt: "2024-01-01T00:00:00Z",
          },
        ]);

      const result = await GameWorldModel.create(worldData);

      // Should not call MIN query when displayOrder is provided
      expect(mockDatabase.query).not.toHaveBeenCalledWith(
        expect.stringContaining("MIN(displayOrder)"),
      );
      expect(result.displayOrder).toBe(50);
    });

    it("should handle negative displayOrder correctly", async () => {
      const worldData: CreateGameWorldData = {
        worldId: "test-world-4",
        name: "Test World 4",
        description: "Test description",
      };

      // Mock existing worlds with minimum displayOrder of -5
      mockDatabase.query
        .mockResolvedValueOnce([{ nextOrder: -15 }]) // MIN(-5) - 10 = -15
        .mockResolvedValueOnce({ insertId: 4 }) // INSERT returns insertId
        .mockResolvedValueOnce([
          {
            // findById returns created world
            id: 4,
            worldId: "test-world-4",
            name: "Test World 4",
            isVisible: true,
            isMaintenance: false,
            displayOrder: -15,
            description: "Test description",
            tags: null,
            createdAt: "2024-01-01T00:00:00Z",
            updatedAt: "2024-01-01T00:00:00Z",
          },
        ]);

      const result = await GameWorldModel.create(worldData);

      expect(result.displayOrder).toBe(-15);
    });
  });

  describe("list", () => {
    it("should return worlds ordered by displayOrder ASC", async () => {
      const mockWorlds = [
        { id: 1, worldId: "world-1", name: "World 1", displayOrder: 0 },
        { id: 2, worldId: "world-2", name: "World 2", displayOrder: 10 },
        { id: 3, worldId: "world-3", name: "World 3", displayOrder: 20 },
      ];

      mockDatabase.query.mockResolvedValueOnce(mockWorlds);

      const result = await GameWorldModel.list({
        sortBy: "displayOrder",
        sortOrder: "ASC",
      });

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining("ORDER BY displayOrder ASC"),
        [],
      );
      expect(result).toEqual(mockWorlds);
    });
  });
});
