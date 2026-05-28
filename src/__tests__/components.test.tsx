import "@testing-library/jest-dom";
import { axe } from "jest-axe";
import { render, screen, fireEvent } from "./utils";
import RatingDisplay from "../components/marketplace/RatingDisplay";
import FilterBar from "../components/marketplace/FilterBar";
import ProviderCard from "../components/marketplace/ProviderCard";

// Mock PriceRange and ServiceBadge components so we focus tests cleanly
jest.mock("../components/marketplace/PriceRange", () => {
  return function MockPriceRange({ minPrice, maxPrice }: { minPrice: number; maxPrice?: number }) {
    return <div data-testid="price-range">${minPrice} - ${maxPrice || "any"}</div>;
  };
});

jest.mock("../components/marketplace/ServiceBadge", () => {
  return function MockServiceBadge({ category }: { category: string }) {
    return <div data-testid="service-badge">{category}</div>;
  };
});

describe("RatingDisplay Component Suite", () => {
  test("renders rating score and count correctly", () => {
    const { container } = render(<RatingDisplay rating={4.5} count={12} />);
    expect(screen.getByText("4.5")).toBeInTheDocument();
    expect(screen.getByText("(12)")).toBeInTheDocument();
    expect(container.firstChild).toMatchSnapshot();
  });

  test("passes accessibility checks", async () => {
    const { container } = render(<RatingDisplay rating={4.5} count={12} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe("FilterBar Component Suite", () => {
  const defaultFilters = {
    category: "saas",
    rating_min: 4,
    price_max: 25000,
  };

  const updateFiltersMock = jest.fn();
  const clearFiltersMock = jest.fn();
  const onTogglePanelMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders active filter chips", () => {
    const { container } = render(
      <FilterBar
        filters={defaultFilters}
        updateFilters={updateFiltersMock}
        clearFilters={clearFiltersMock}
        onTogglePanel={onTogglePanelMock}
        panelOpen={false}
      />
    );

    expect(screen.getByText("Active Filters (3):")).toBeInTheDocument();
    expect(screen.getByText(/SaaS Dev/i)).toBeInTheDocument();
    expect(screen.getByText("Rating: 4+ ★")).toBeInTheDocument();
    expect(screen.getByText("Max starting: $25,000")).toBeInTheDocument();
    expect(container.firstChild).toMatchSnapshot();
  });

  test("triggers clearFilters callback when clear all is clicked", () => {
    render(
      <FilterBar
        filters={defaultFilters}
        updateFilters={updateFiltersMock}
        clearFilters={clearFiltersMock}
      />
    );

    fireEvent.click(screen.getByTitle("Clear all filters"));
    expect(clearFiltersMock).toHaveBeenCalledTimes(1);
  });

  test("triggers updateFilters callback when filter chips are removed", () => {
    render(
      <FilterBar
        filters={defaultFilters}
        updateFilters={updateFiltersMock}
        clearFilters={clearFiltersMock}
      />
    );

    fireEvent.click(screen.getByTitle("Remove Category"));
    expect(updateFiltersMock).toHaveBeenLastCalledWith({
      ...defaultFilters,
      category: undefined,
    });

    fireEvent.click(screen.getByTitle("Remove Rating"));
    expect(updateFiltersMock).toHaveBeenLastCalledWith({
      ...defaultFilters,
      rating_min: undefined,
    });

    fireEvent.click(screen.getByTitle("Remove budget cap"));
    expect(updateFiltersMock).toHaveBeenLastCalledWith({
      ...defaultFilters,
      price_max: undefined,
    });
  });

  test("triggers onTogglePanel callback when toggle button is clicked", () => {
    render(
      <FilterBar
        filters={defaultFilters}
        updateFilters={updateFiltersMock}
        clearFilters={clearFiltersMock}
        onTogglePanel={onTogglePanelMock}
        panelOpen={false}
      />
    );

    fireEvent.click(screen.getByText("Filter Panel"));
    expect(onTogglePanelMock).toHaveBeenCalledTimes(1);
  });

  test("passes accessibility checks", async () => {
    const { container } = render(
      <FilterBar
        filters={defaultFilters}
        updateFilters={updateFiltersMock}
        clearFilters={clearFiltersMock}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe("ProviderCard Component Suite", () => {
  const mockProps = {
    id: "provider-id-1",
    name: "Apex Software Labs",
    description: "Providing stellar full-stack development services.",
    category: "software-development",
    rating: 4.8,
    reviewCount: 42,
    minPrice: 5000,
    maxPrice: 20000,
    techStack: ["React", "TypeScript", "Node.js", "GraphQL"],
    status: "active",
    completionRate: 98,
    avgResponseTime: 12,
  };

  test("renders provider name, tags and trust scores", () => {
    const { container } = render(<ProviderCard {...mockProps} />);
    expect(screen.getByText("Apex Software Labs")).toBeInTheDocument();
    expect(screen.getByText("Providing stellar full-stack development services.")).toBeInTheDocument();
    expect(screen.getByText("Trust: 99")).toBeInTheDocument();
    expect(screen.getByTestId("service-badge")).toHaveTextContent("software-development");
    expect(screen.getByTestId("price-range")).toHaveTextContent("$5000 - $20000");
    expect(container.firstChild).toMatchSnapshot();
  });

  test("passes accessibility checks", async () => {
    const { container } = render(<ProviderCard {...mockProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
