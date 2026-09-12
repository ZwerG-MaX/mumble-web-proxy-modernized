//! RFC 5764: DTLS-SRTP

use openssl::ssl::{SslAcceptor, SslAcceptorBuilder};
use std::collections::VecDeque;
use std::io::{self, Read, Write};
use std::pin::Pin;
use std::task::{Context, Poll};

use futures::{Sink, Stream};

/// DTLS-SRTP stream component (placeholder)
pub struct StreamComponent {
    _private: (),
}

impl StreamComponent {
    pub fn new() -> Self {
        Self { _private: () }
    }
}

impl Read for StreamComponent {
    fn read(&mut self, _buf: &mut [u8]) -> io::Result<usize> {
        Ok(0)
    }
}

impl Write for StreamComponent {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        Ok(buf.len())
    }

    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

/// DTLS-SRTP wrapper
pub struct DtlsSrtp<S, A> {
    _stream: Option<S>,
    _acceptor: Option<A>,
    _buffer: VecDeque<Vec<u8>>,
}

impl<S, A> DtlsSrtp<S, A> {
    pub fn handshake(
        stream: S,
        acceptor: A,
    ) -> Pin<Box<dyn std::future::Future<Output = Result<Self, io::Error>> + Send>>
    where
        S: Read + Write + Send + 'static,
        A: Into<SslAcceptorBuilder> + Send + 'static,
    {
        Box::pin(async move {
            Ok(Self {
                _stream: Some(stream),
                _acceptor: Some(acceptor),
                _buffer: VecDeque::new(),
            })
        })
    }

    pub fn add_incoming_unknown_ssrcs(&mut self, _count: usize) {}

    pub fn add_outgoing_unknown_ssrcs(&mut self, _count: usize) {}
}

impl<S, A> Stream for DtlsSrtp<S, A>
where
    S: Unpin,
    A: Unpin,
{
    type Item = Result<Vec<u8>, crate::Error>;

    fn poll_next(self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        Poll::Pending
    }
}

impl<S, A> Sink<&[u8]> for DtlsSrtp<S, A>
where
    S: Unpin,
    A: Unpin,
{
    type Error = crate::Error;

    fn poll_ready(self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        Poll::Ready(Ok(()))
    }

    fn start_send(self: Pin<&mut Self>, _item: &[u8]) -> Result<(), Self::Error> {
        Ok(())
    }

    fn poll_flush(self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        Poll::Ready(Ok(()))
    }

    fn poll_close(self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        Poll::Ready(Ok(()))
    }
}
