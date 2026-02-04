import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LoadingIndicator, PageLoading, FullScreenLoading } from '../LoadingIndicator';

describe('LoadingIndicator', () => {
  it('renders circular loading indicator by default', () => {
    render(<LoadingIndicator />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders with custom message', () => {
    const message = 'Loading data...';
    render(<LoadingIndicator message={message} />);
    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it('renders linear variant', () => {
    render(<LoadingIndicator variant="linear" />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders inline variant', () => {
    const message = 'Processing...';
    render(<LoadingIndicator variant="inline" message={message} />);
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});

describe('PageLoading', () => {
  it('renders page loading component', () => {
    render(<PageLoading />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders with custom message', () => {
    const message = 'Loading page content...';
    render(<PageLoading message={message} />);
    expect(screen.getByText(message)).toBeInTheDocument();
  });
});

describe('FullScreenLoading', () => {
  it('renders full screen loading component', () => {
    render(<FullScreenLoading />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders with custom message', () => {
    const message = 'Initializing application...';
    render(<FullScreenLoading message={message} />);
    expect(screen.getByText(message)).toBeInTheDocument();
  });
});
