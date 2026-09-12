//! See `test::connects_and_transmits_data` for a usage example.
use crate::ffi;
use futures::channel::mpsc;
use futures::executor::block_on;
use futures::io::{AsyncRead, AsyncWrite};
use futures::pin_mut;
use futures::ready;
use futures::sink::SinkExt;
use futures::task::Poll;
use futures::Sink;
use futures::Stream as FuturesStream;
use glib::MainContext;
use glib::MainLoop;
use std::collections::HashMap;
use std::ffi::CString;
use std::future::Future;
use std::io;
use std::io::Read;
use std::ops::DerefMut;
use std::os::raw::c_uint;
use std::pin::Pin;
use std::sync::Arc;
use std::sync::Mutex;
use std::task::Context;

pub use crate::ffi::BoolResult;
pub use crate::ffi::NiceCompatibility;
pub use crate::ffi::NiceComponentState as ComponentState;
pub use webrtc_sdp::attribute_type::SdpAttributeCandidate as Candidate;

type ComponentId = (c_uint, c_uint);

/// A single, high-level ICE agent.
pub struct Agent {
    ctx: MainContext,
    agent: ffi::NiceAgent,
    main_loop: MainLoop,
    msgs_sender: mpsc::UnboundedSender<ControlMsg>,
    msgs: mpsc::UnboundedReceiver<ControlMsg>,
    candidate_sinks: Arc<Mutex<HashMap<c_uint, mpsc::UnboundedSender<Candidate>>>>,
    state_sinks: Arc<Mutex<HashMap<ComponentId, mpsc::Sender<ComponentState>>>>,
}

impl Agent {
    /// Creates a new ICE agent in RFC5245 (ICE) compatibility mode.
    pub fn new_rfc5245() -> Self {
        Self::new(NiceCompatibility::RFC5245)
    }

    /// Creates a new ICE agent with the specified compatibility mode.
    pub fn new(compat: NiceCompatibility) -> Self {
        let ctx = MainContext::new();
        let main_loop = MainLoop::new(Some(&ctx), false);
        let mut agent = ffi::NiceAgent::new(&ctx, compat);

        let main_loop_clone = main_loop.clone();
        std::thread::spawn(move || {
            main_loop_clone.run();
        });

        let (msgs_sender, msgs) = mpsc::unbounded();

        let candidate_sinks: Arc<Mutex<HashMap<c_uint, mpsc::UnboundedSender<Candidate>>>> =
            Default::default();
        let candidate_sinks_clone = Arc::clone(&candidate_sinks);
        agent
            .on_new_candidate(move |candidate| {
                let mut candidate_sinks = candidate_sinks_clone.lock().unwrap();
                let stream_id = &candidate.stream_id();
                if let Some(sink) = candidate_sinks.get_mut(stream_id) {
                    if sink.unbounded_send(candidate.to_sdp()).is_err() {
                        candidate_sinks.remove(stream_id);
                    }
                }
            })
            .unwrap();
        let candidate_sinks_clone = Arc::clone(&candidate_sinks);
        agent
            .on_candidate_gathering_done(move |stream_id| {
                let mut candidate_sinks = candidate_sinks_clone.lock().unwrap();
                candidate_sinks.remove(&stream_id);
            })
            .unwrap();

        let state_sinks: Arc<Mutex<HashMap<ComponentId, mpsc::Sender<ComponentState>>>> =
            Default::default();
        let state_sinks_clone = Arc::clone(&state_sinks);
        agent
            .on_component_state_changed(move |stream_id, component_id, new_state| {
                let mut state_sinks = state_sinks_clone.lock().unwrap();
                let key = (stream_id, component_id);
                if let Some(sink) = state_sinks.get_mut(&key) {
                    if block_on(sink.send(new_state)).is_err() {
                        state_sinks.remove(&key);
                    }
                }
            })
            .unwrap();

        Agent {
            ctx,
            agent,
            main_loop,
            msgs_sender,
            msgs,
            candidate_sinks,
            state_sinks,
        }
    }

    /// Returns the context this agent is running on.
    pub fn get_ctx(&self) -> &MainContext {
        &self.ctx
    }

    /// Returns the low-level agent backing this Agent.
    pub fn get_ffi_agent(&mut self) -> &mut ffi::NiceAgent {
        &mut self.agent
    }

    /// See the [libnice] documentation for more info.
    pub fn set_software(&mut self, name: impl Into<String>) {
        let name = CString::new(name.into()).expect("name must not have have null bytes");
        self.agent.set_software(name);
    }

    /// Changes whether this agent is in controlling mode.
    pub fn set_controlling_mode(&mut self, controlling: bool) {
        self.agent.set_controlling_mode(controlling);
    }

    /// Add a new [Stream] with the specified amount of components to the agent.
    pub fn stream_builder(&mut self, components: usize) -> StreamBuilder {
        StreamBuilder::new(self, components)
    }

    fn handle_msg(&mut self, msg: ControlMsg) {
        match msg {
            ControlMsg::SetRemoteCredentials(stream_id, ufrag, pwd) => {
                let _ = self.agent.set_remote_credentials(stream_id, &ufrag, &pwd);
            }
            ControlMsg::AddRemoteCandidate((stream_id, component_id), candidate) => {
                let candidate = match ffi::NiceCandidate::from_sdp_without_fqdn(&candidate) {
                    Ok(candidate) => candidate,
                    Err(_) => return,
                };
                let candidate_ref = &candidate;
                let candidates = std::slice::from_ref(&candidate_ref);
                let _ = self
                    .agent
                    .add_remote_candidates(stream_id, component_id, candidates);
            }
            ControlMsg::Send((stream_id, component_id), buf) => {
                let _ = self.agent.send(stream_id, component_id, &buf);
            }
        }
    }
}

impl Drop for Agent {
    fn drop(&mut self) {
        self.main_loop.quit();
    }
}

impl Future for Agent {
    type Output = ();

    fn poll(mut self: Pin<&mut Self>, cx: &mut Context) -> Poll<Self::Output> {
        loop {
            let msg = {
                let msgs = &mut self.msgs;
                pin_mut!(msgs);
                ready!(msgs.poll_next(cx)).expect("msgs stream ended prematurely")
            };
            self.handle_msg(msg);
        }
    }
}

/// Builder for ICE [Stream]s.
pub struct StreamBuilder<'a> {
    agent: &'a mut Agent,
    components: usize,
    inbound_buf_size: usize,
    port_ranges: HashMap<usize, (u16, u16)>,
}

impl<'a> StreamBuilder<'a> {
    /// See [Agent::stream_builder].
    pub fn new(agent: &'a mut Agent, components: usize) -> Self {
        Self {
            agent,
            components,
            inbound_buf_size: 10,
            port_ranges: HashMap::new(),
        }
    }

    /// Sets the size of the buffer used to store inbound packets.
    pub fn set_inbound_buffer_size(&mut self, size: usize) -> &mut Self {
        self.inbound_buf_size = size;
        self
    }

    /// Limits the range of ports used for host candidates.
    pub fn set_port_range(&mut self, min_port: u16, max_port: u16) -> &mut Self {
        for i in 0..self.components {
            self.port_ranges.insert(i, (min_port, max_port));
        }
        self
    }

    /// Limits the range of ports used for host candidates for the component at the specified index.
    pub fn set_component_port_range(
        &mut self,
        component_index: usize,
        min_port: u16,
        max_port: u16,
    ) -> &mut Self {
        if component_index >= self.components {
            panic!(
                "index {} of of range (size: {})",
                component_index, self.components
            );
        }
        self.port_ranges
            .insert(component_index, (min_port, max_port));
        self
    }

    /// Build the [Stream].
    pub fn build(&mut self) -> BoolResult<Stream> {
        let agent = &mut self.agent;
        let state_sinks = &mut agent.state_sinks;
        let ffi = &mut agent.agent;

        let id = ffi.add_stream(self.components as c_uint)?;
        let (local_ufrag, local_pwd) = ffi.get_local_credentials(id).expect("local credentials");
        let local_ufrag = local_ufrag
            .into_string()
            .expect("generated ufrag is valid utf8");
        let local_pwd = local_pwd
            .into_string()
            .expect("generated pwd is valid utf8");

        let mut components = Vec::new();
        for i in 0..(self.components as c_uint) {
            let component_id = i + 1;
            let (mut source_sender, source) = mpsc::channel(self.inbound_buf_size);
            let recv_handle = ffi.attach_recv(id, component_id, &agent.ctx, move |buf| {
                let _ = source_sender.try_send(buf.to_vec());
            })?;

            let (state_sender, state_stream) = mpsc::channel(8);
            state_sinks
                .lock()
                .unwrap()
                .insert((id, component_id), state_sender);

            components.push(StreamComponent {
                _recv_handle: recv_handle,
                stream_id: id,
                component_id,
                state: ComponentState::Disconnected,
                state_stream,
                source,
                sink: agent.msgs_sender.clone(),
            });
        }

        let (candidate_sink, candidates) = mpsc::unbounded();
        agent
            .candidate_sinks
            .lock()
            .unwrap()
            .insert(id, candidate_sink);

        for (index, (min_port, max_port)) in &self.port_ranges {
            ffi.set_port_range(id, *index as c_uint + 1, *min_port, *max_port);
        }

        ffi.gather_candidates(id)?;

        Ok(Stream {
            id,
            local_ufrag,
            local_pwd,
            msg_sink: agent.msgs_sender.clone(),
            candidates,
            components,
        })
    }
}

enum ControlMsg {
    SetRemoteCredentials(c_uint, CString, CString),
    AddRemoteCandidate(ComponentId, Candidate),
    Send(ComponentId, Vec<u8>),
}

/// An ICE stream consisting of multiple components.
pub struct Stream {
    id: c_uint,
    local_ufrag: String,
    local_pwd: String,
    msg_sink: mpsc::UnboundedSender<ControlMsg>,
    candidates: mpsc::UnboundedReceiver<Candidate>,
    components: Vec<StreamComponent>,
}

impl Stream {
    /// See [Agent::stream_builder].
    pub fn builder(agent: &mut Agent, components: usize) -> StreamBuilder {
        StreamBuilder::new(agent, components)
    }

    /// Returns the local STUN ufrag for this stream.
    pub fn get_local_ufrag(&self) -> &str {
        &self.local_ufrag
    }

    /// Returns the local STUN pwd for this stream.
    pub fn get_local_pwd(&self) -> &str {
        &self.local_pwd
    }

    /// Set the remote STUN credentials for this stream.
    pub fn set_remote_credentials(&mut self, ufrag: CString, pwd: CString) {
        let msg = ControlMsg::SetRemoteCredentials(self.id, ufrag, pwd);
        let _ = self.msg_sink.unbounded_send(msg);
    }

    /// Adds a new remote ICE candidate for this stream.
    pub fn add_remote_candidate(&mut self, candidate: Candidate) {
        let msg = ControlMsg::AddRemoteCandidate((self.id, candidate.component), candidate);
        let _ = self.msg_sink.unbounded_send(msg);
    }

    /// Returns a references to the components of this stream.
    pub fn components(&self) -> &[StreamComponent] {
        &self.components
    }

    /// Returns a mutable references to the components of this stream.
    pub fn mut_components(&mut self) -> &mut [StreamComponent] {
        &mut self.components
    }

    /// Returns the components of this stream, returning an empty Vec on subsequent calls.
    pub fn take_components(&mut self) -> Vec<StreamComponent> {
        std::mem::replace(&mut self.components, Vec::new())
    }

    /// Returns the components of this stream, consuming the stream.
    pub fn into_components(self) -> Vec<StreamComponent> {
        self.components
    }
}

impl FuturesStream for Stream {
    type Item = Candidate;

    fn poll_next(mut self: Pin<&mut Self>, cx: &mut Context) -> Poll<Option<Self::Item>> {
        let f = &mut self.candidates;
        pin_mut!(f);
        f.poll_next(cx)
    }
}

/// A single ICE stream component.
pub struct StreamComponent {
    _recv_handle: ffi::AttachRecvHandle,
    stream_id: c_uint,
    component_id: c_uint,
    state: ComponentState,
    state_stream: mpsc::Receiver<ComponentState>,
    source: mpsc::Receiver<Vec<u8>>,
    sink: mpsc::UnboundedSender<ControlMsg>,
}

impl StreamComponent {
    /// Adds a remote ICE candidate to this stream component.
    pub fn add_remote_candidate(&mut self, candidate: Candidate) {
        let msg = ControlMsg::AddRemoteCandidate((self.stream_id, self.component_id), candidate);
        let _ = self.sink.unbounded_send(msg);
    }

    /// Sends a packet of data via this component.
    pub fn unbounded_send(&mut self, item: Vec<u8>) {
        let msg = ControlMsg::Send((self.stream_id, self.component_id), item);
        let _ = self.sink.unbounded_send(msg);
    }

    /// Returns the current state of this component.
    pub fn get_state(&self) -> ComponentState {
        self.state
    }

    /// Returns a future which waits until the component is in the target state.
    pub fn wait_for_state(self, target: ComponentState) -> ComponentStateFuture {
        ComponentStateFuture {
            component: Some(self),
            target,
        }
    }

    fn poll_state(&mut self, cx: &mut Context) -> Poll<()> {
        loop {
            let state_stream = &mut self.state_stream;
            pin_mut!(state_stream);
            match state_stream.poll_next(cx) {
                Poll::Pending => return Poll::Pending,
                Poll::Ready(Some(new_state)) => {
                    self.state = new_state;
                }
                Poll::Ready(None) => return Poll::Ready(()),
            }
        }
    }
}

/// Future returned by [StreamComponent::wait_for_state]
pub struct ComponentStateFuture {
    component: Option<StreamComponent>,
    target: ComponentState,
}

impl Future for ComponentStateFuture {
    type Output = Option<StreamComponent>;

    fn poll(self: Pin<&mut Self>, cx: &mut Context) -> Poll<Self::Output> {
        fn rate(state: ComponentState) -> u8 {
            match state {
                ComponentState::Disconnected => 0,
                ComponentState::Gathering => 1,
                ComponentState::Connecting => 2,
                ComponentState::Connected => 3,
                ComponentState::Ready => 4,
                ComponentState::Failed => 5,
            }
        }
        let this = self.get_mut();
        let component = this.component.as_mut().expect("poll called after Ready");
        if let Poll::Ready(()) = component.poll_state(cx) {
            return Poll::Ready(None);
        }
        if rate(component.state) >= rate(this.target) {
            if component.state == ComponentState::Failed {
                Poll::Ready(None)
            } else {
                Poll::Ready(Some(this.component.take().unwrap()))
            }
        } else {
            Poll::Pending
        }
    }
}

impl FuturesStream for StreamComponent {
    type Item = Vec<u8>;

    fn poll_next(mut self: Pin<&mut Self>, cx: &mut Context) -> Poll<Option<Self::Item>> {
        if let Poll::Ready(()) = self.deref_mut().poll_state(cx) {
            return Poll::Ready(None);
        }
        let source = &mut self.source;
        pin_mut!(source);
        source.poll_next(cx)
    }
}

impl Sink<Vec<u8>> for StreamComponent {
    type Error = ();

    fn poll_ready(self: Pin<&mut Self>, _cx: &mut Context) -> Poll<Result<(), Self::Error>> {
        Poll::Ready(Ok(()))
    }

    fn start_send(self: Pin<&mut Self>, item: Vec<u8>) -> Result<(), Self::Error> {
        let msg = ControlMsg::Send((self.stream_id, self.component_id), item);
        let _ = self.sink.unbounded_send(msg);
        Ok(())
    }

    fn poll_flush(self: Pin<&mut Self>, _cx: &mut Context) -> Poll<Result<(), Self::Error>> {
        Poll::Ready(Ok(()))
    }

    fn poll_close(self: Pin<&mut Self>, _cx: &mut Context) -> Poll<Result<(), Self::Error>> {
        Poll::Ready(Ok(()))
    }
}

impl AsyncRead for StreamComponent {
    fn poll_read(
        self: Pin<&mut Self>,
        cx: &mut Context,
        buf: &mut [u8],
    ) -> Poll<Result<usize, io::Error>> {
        match self.poll_next(cx) {
            Poll::Ready(Some(vec)) => Poll::Ready(vec.as_slice().read(buf)),
            Poll::Ready(None) => Poll::Ready(Ok(0)),
            Poll::Pending => Poll::Pending,
        }
    }
}

impl AsyncWrite for StreamComponent {
    fn poll_write(
        self: Pin<&mut Self>,
        _cx: &mut Context,
        buf: &[u8],
    ) -> Poll<Result<usize, io::Error>> {
        let _ = self.start_send(buf.to_vec());
        Poll::Ready(Ok(buf.len()))
    }

    fn poll_flush(self: Pin<&mut Self>, _cx: &mut Context) -> Poll<Result<(), io::Error>> {
        Poll::Ready(Ok(()))
    }

    fn poll_close(self: Pin<&mut Self>, _cx: &mut Context) -> Poll<Result<(), io::Error>> {
        Poll::Ready(Ok(()))
    }
}
